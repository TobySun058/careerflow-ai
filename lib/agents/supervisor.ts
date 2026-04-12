import type {
  ChatResponse,
  DraftArtifact,
  EvidenceRef,
  SessionRecord,
  WorkflowBundle,
  WorkflowTraceStep
} from "@/lib/schemas";
import { hasModelConfig } from "@/lib/config";
import { getJobDiscoveryProvider } from "@/lib/providers/jobs";
import { getStorage } from "@/lib/storage";
import { generateText } from "@/lib/tools/model";
import {
  appendMatchReportSnapshot,
  createChatMessage,
  getSessionSources,
  upsertJobProfileSnapshot
} from "@/lib/tools/session-state";
import {
  retrieveOpportunityEvidence,
  retrieveTruthEvidence,
  type RetrievedEvidence
} from "@/lib/tools/retrieve";
import { makeId } from "@/lib/utils";

import { runInterviewPrepAgent } from "./interview-prep";
import { runMatchAgent } from "./match";
import { runPlannerAgent } from "./planner";
import { runResumeEvidenceAgent } from "./resume-evidence";
import { runRoleResearchAgent } from "./role-research";
import { upsertArtifact, type AgentContext } from "./shared";
import { runApplicationWriterAgent } from "./writer";

type ChatIntent =
  | "general_qa"
  | "summarize_role"
  | "analyze_match"
  | "rewrite_resume"
  | "draft_outreach"
  | "interview_prep"
  | "build_plan"
  | "search_jobs"
  | "finalize_resume";

function buildContext(
  session: SessionRecord,
  chunks: Awaited<ReturnType<ReturnType<typeof getStorage>["getChunkIndex"]>>
) {
  return {
    session,
    chunks,
    updateTrace(step: WorkflowTraceStep) {
      session.workflowTrace.push({
        ...step,
        id: step.id ?? makeId("trace")
      });
      session.updatedAt = new Date().toISOString();
    }
  } satisfies AgentContext;
}

function replaceArtifacts(session: SessionRecord, artifacts: DraftArtifact[]) {
  artifacts.forEach((artifact) => {
    upsertArtifact(session.artifacts, artifact);
    if (artifact.type === "plan") {
      session.plan = artifact;
    }
  });
}

function hasTruthSources(session: SessionRecord) {
  return getSessionSources(session).some((source) => source.kind === "truth");
}

function hasOpportunitySources(session: SessionRecord) {
  return getSessionSources(session).some((source) => source.kind === "opportunity");
}

async function ensureCandidateProfile(context: AgentContext) {
  if (!context.session.candidateProfile && hasTruthSources(context.session)) {
    context.session.candidateProfile = await runResumeEvidenceAgent(context);
  }

  return context.session.candidateProfile;
}

async function ensureJobProfile(context: AgentContext) {
  if (!context.session.jobProfile && hasOpportunitySources(context.session)) {
    context.session.jobProfile = await runRoleResearchAgent(context);
  }

  if (context.session.jobProfile) {
    upsertJobProfileSnapshot(context.session, context.session.jobProfile);
  }

  return context.session.jobProfile;
}

function uniqueSourceRefs(refs: EvidenceRef[]) {
  return refs.filter(
    (ref, index, list) =>
      list.findIndex(
        (candidate) =>
          candidate.sourceId === ref.sourceId && candidate.chunkId === ref.chunkId
      ) === index
  );
}

function evidenceToRefs(evidence: RetrievedEvidence[]): EvidenceRef[] {
  return evidence.map((item) => ({
    sourceId: item.sourceId,
    chunkId: item.chunkId,
    kind: item.kind,
    title: item.title,
    excerpt: item.excerpt
  }));
}

function summarizeMatchArtifact(session: SessionRecord) {
  const matchReport = session.matchReport;
  if (!matchReport) {
    return "I compared your current truth-store evidence against the role, but I need both a resume and a role source to produce a grounded match analysis.";
  }

  return [
    `Fit looks like ${matchReport.fitScore}/100 based on the current grounded evidence.`,
    matchReport.strengths[0]
      ? `Strongest signal: ${matchReport.strengths[0]}`
      : "",
    matchReport.gaps[0] ? `Biggest gap: ${matchReport.gaps[0]}` : "",
    "The detailed match card is attached below."
  ]
    .filter(Boolean)
    .join(" ");
}

function summarizeSearchResults(count: number) {
  if (!count) {
    return "I searched for adjacent roles but didn't find seeded results for this query yet.";
  }

  return `I found ${count} adjacent roles. The latest results are visible in the action rail so you can compare options quickly.`;
}

function isGreetingMessage(message: string) {
  return /^(hi|hello|hey|yo|good morning|good afternoon|good evening)\b[!. ]*$/i.test(
    message.trim()
  );
}

function summarizeEvidenceTitles(evidence: RetrievedEvidence[]) {
  const uniqueTitles = Array.from(new Set(evidence.map((item) => item.title))).slice(0, 3);
  return uniqueTitles.length ? uniqueTitles.join(", ") : "your current sources";
}

function humanizeSourceType(type: string) {
  return type.replaceAll("_", " ");
}

function formatSourceList(items: Array<{ title: string; type: string }>) {
  return items
    .map((item) => `${item.title} (${humanizeSourceType(item.type)})`)
    .join(", ");
}

function isSourceInventoryQuestion(message: string) {
  const lowered = message.toLowerCase();
  return (
    /(what|which|show|list|did|do i have|have i|what's|whats).*(source|sources|upload|uploaded|resume|job description|job posting|role)/.test(
      lowered
    ) ||
    /(what .*did i upload|what .*have i uploaded|what sources do i have)/.test(lowered)
  );
}

function answerSourceInventoryQuestion(session: SessionRecord, message: string) {
  const lowered = message.toLowerCase();
  const sources = getSessionSources(session);
  const truthSources = sources.filter((source) => source.kind === "truth");
  const opportunitySources = sources.filter((source) => source.kind === "opportunity");
  const activeResume = sources.find((source) => source.type === "resume" && source.active);
  const jobDescriptionSources = sources.filter((source) => source.type === "job_description");

  if (/(resume|cv)/.test(lowered)) {
    if (activeResume) {
      return {
        content: `Your active resume is ${activeResume.title}.`,
        sourceRefs: [] as EvidenceRef[]
      };
    }

    return {
      content: "I don't see an active resume in this session yet.",
      sourceRefs: [] as EvidenceRef[]
    };
  }

  if (/(job description|job posting|role source|opportunity source)/.test(lowered)) {
    if (jobDescriptionSources.length) {
      return {
        content: `You currently have ${jobDescriptionSources.length} direct job description source${jobDescriptionSources.length === 1 ? "" : "s"}: ${formatSourceList(jobDescriptionSources)}.`,
        sourceRefs: [] as EvidenceRef[]
      };
    }

    if (opportunitySources.length) {
      return {
        content: `You don't currently have a pasted job description source. Your opportunity source${opportunitySources.length === 1 ? " is" : "s are"} ${formatSourceList(opportunitySources)}.`,
        sourceRefs: [] as EvidenceRef[]
      };
    }

    return {
      content: "I don't see any opportunity sources in this session yet.",
      sourceRefs: [] as EvidenceRef[]
    };
  }

  return {
    content: `You currently have ${truthSources.length} truth source${truthSources.length === 1 ? "" : "s"} and ${opportunitySources.length} opportunity source${opportunitySources.length === 1 ? "" : "s"}. Truth: ${truthSources.length ? formatSourceList(truthSources) : "none"}. Opportunity: ${opportunitySources.length ? formatSourceList(opportunitySources) : "none"}.`,
    sourceRefs: [] as EvidenceRef[]
  };
}

function getMissingRequirements(session: SessionRecord, intents: ChatIntent[]) {
  const needsTruth = intents.some((intent) =>
    [
      "analyze_match",
      "rewrite_resume",
      "draft_outreach",
      "interview_prep",
      "build_plan",
      "finalize_resume"
    ].includes(intent)
  );
  const needsOpportunity = intents.some((intent) =>
    [
      "summarize_role",
      "analyze_match",
      "rewrite_resume",
      "draft_outreach",
      "interview_prep",
      "build_plan",
      "search_jobs",
      "finalize_resume"
    ].includes(intent)
  );
  const missing: string[] = [];

  if (needsTruth && !hasTruthSources(session)) {
    missing.push("Add a resume or another truth-source document first.");
  }

  if (needsOpportunity && !hasOpportunitySources(session)) {
    missing.push("Add a job description, company URL, or another opportunity source first.");
  }

  return missing;
}

function mapExplicitIntent(explicitIntent?: string): ChatIntent[] {
  switch (explicitIntent) {
    case "analyze_match":
      return ["analyze_match"];
    case "rewrite_resume":
      return ["rewrite_resume"];
    case "draft_outreach":
      return ["draft_outreach"];
    case "generate_interview_prep":
      return ["interview_prep"];
    case "build_plan":
      return ["build_plan"];
    case "search_jobs":
      return ["search_jobs"];
    case "finalize_resume":
      return ["finalize_resume"];
    default:
      return [];
  }
}

function inferChatIntents(message: string, explicitIntent?: string): ChatIntent[] {
  const explicit = mapExplicitIntent(explicitIntent);
  if (explicit.length) {
    return explicit;
  }

  const lowered = message.toLowerCase();
  const intents = new Set<ChatIntent>();

  if (/(summarize|summary|company|job posting|role overview)/.test(lowered)) {
    intents.add("summarize_role");
  }

  if (/(fit|match|gap|strength|keyword|should i apply|am i qualified|enough experience)/.test(lowered)) {
    intents.add("analyze_match");
  }

  if (/(rewrite|tailor|resume|bullet|cv)/.test(lowered)) {
    intents.add("rewrite_resume");
  }

  if (/(finalize|ats)/.test(lowered)) {
    intents.add("finalize_resume");
  }

  if (/(outreach|cold email|network|networking|linkedin|message|email)/.test(lowered)) {
    intents.add("draft_outreach");
  }

  if (/(interview|question|behavioral|technical|tell me about yourself)/.test(lowered)) {
    intents.add("interview_prep");
  }

  if (/(plan|next step|next-step|checklist|what should i do next)/.test(lowered)) {
    intents.add("build_plan");
  }

  if (/(find me|search jobs|internships like this|roles like this|similar jobs)/.test(lowered)) {
    intents.add("search_jobs");
  }

  if (!intents.size) {
    intents.add("general_qa");
  }

  return Array.from(intents).sort((left, right) => {
    const order: ChatIntent[] = [
      "summarize_role",
      "analyze_match",
      "rewrite_resume",
      "finalize_resume",
      "draft_outreach",
      "interview_prep",
      "build_plan",
      "search_jobs",
      "general_qa"
    ];
    return order.indexOf(left) - order.indexOf(right);
  });
}

export async function runSupervisorWorkflow(
  sessionId: string
): Promise<WorkflowBundle> {
  const storage = getStorage();
  const session = await storage.getSession(sessionId);

  if (!session) {
    throw new Error("Session not found.");
  }

  const chunks = await storage.getChunkIndex(sessionId);
  const context = buildContext(session, chunks);

  session.workflowTrace = [];
  session.candidateProfile = await runResumeEvidenceAgent(context);
  session.jobProfile = await runRoleResearchAgent(context);

  const matchResult = await runMatchAgent(context);
  session.matchReport = matchResult.matchReport;
  replaceArtifacts(session, [matchResult.artifact]);

  const writerArtifacts = await runApplicationWriterAgent(context);
  replaceArtifacts(session, writerArtifacts);

  const interviewArtifact = await runInterviewPrepAgent(context);
  replaceArtifacts(session, [interviewArtifact]);

  const plannerResult = await runPlannerAgent(context);
  replaceArtifacts(session, [plannerResult.artifact]);
  session.notes = [plannerResult.sessionSummary];
  session.updatedAt = new Date().toISOString();

  await storage.saveSession(session);

  return {
    session,
    artifacts: session.artifacts,
    match: session.matchReport,
    workflowTrace: session.workflowTrace
  };
}

function inferFollowUpTargets(instruction: string) {
  const lowered = instruction.toLowerCase();

  if (/(interview|question|harder|behavioral|technical)/.test(lowered)) {
    return ["interview"];
  }

  if (/(plan|checklist|next step)/.test(lowered)) {
    return ["plan"];
  }

  if (/(fit|score|gap|keyword|emphasis)/.test(lowered)) {
    return ["match"];
  }

  if (/(ats)/.test(lowered)) {
    return ["writer-ats"];
  }

  return ["writer"];
}

export async function runSupervisorFollowUp(
  sessionId: string,
  instruction: string
): Promise<WorkflowBundle> {
  const storage = getStorage();
  const session = await storage.getSession(sessionId);

  if (!session) {
    throw new Error("Session not found.");
  }

  const chunks = await storage.getChunkIndex(sessionId);
  const context = buildContext(session, chunks);
  const targets = inferFollowUpTargets(instruction);
  const freshArtifacts: DraftArtifact[] = [];

  if (!session.candidateProfile) {
    session.candidateProfile = await runResumeEvidenceAgent(context);
  }

  if (!session.jobProfile) {
    session.jobProfile = await runRoleResearchAgent(context);
  }

  if (targets.includes("match")) {
    const matchResult = await runMatchAgent(context);
    session.matchReport = matchResult.matchReport;
    freshArtifacts.push(matchResult.artifact);
  }

  if (targets.includes("writer")) {
    freshArtifacts.push(...(await runApplicationWriterAgent(context, { instruction })));
  }

  if (targets.includes("writer-ats")) {
    freshArtifacts.push(
      ...(await runApplicationWriterAgent(context, {
        instruction,
        mode: "ats"
      }))
    );
  }

  if (targets.includes("interview")) {
    freshArtifacts.push(await runInterviewPrepAgent(context, { instruction }));
  }

  if (targets.includes("plan")) {
    const planResult = await runPlannerAgent(context, { instruction });
    freshArtifacts.push(planResult.artifact);
    session.notes = [planResult.sessionSummary];
  }

  replaceArtifacts(session, freshArtifacts);
  session.updatedAt = new Date().toISOString();
  await storage.saveSession(session);

  return {
    session,
    artifacts: freshArtifacts,
    match: session.matchReport,
    workflowTrace: session.workflowTrace
  };
}

async function composeGroundedAnswer(
  context: AgentContext,
  message: string,
  intents: ChatIntent[]
) {
  if (isSourceInventoryQuestion(message)) {
    return answerSourceInventoryQuestion(context.session, message);
  }

  if (isGreetingMessage(message)) {
    return {
      content: hasModelConfig()
        ? "Hi! I can help you analyze fit, rewrite your resume, draft outreach, generate interview prep, or review the current role. Ask naturally and I'll route it."
        : "Hi! I can help with fit analysis, resume tailoring, outreach, interview prep, and role review. Featherless isn't configured in this workspace yet, so set FEATHERLESS_API_KEY and restart the app to enable full conversational responses.",
      sourceRefs: [] as EvidenceRef[]
    };
  }

  const useTruthOnly =
    intents.includes("general_qa") &&
    /(my|me|i |experience|resume|skills|background)/.test(message.toLowerCase()) &&
    !/(role|job|company|posting)/.test(message.toLowerCase());
  const useOpportunityOnly =
    intents.includes("summarize_role") ||
    (intents.includes("general_qa") &&
      /(job|company|role|posting|requirements)/.test(message.toLowerCase()) &&
      !/(my|me|i |experience|resume|skills|background)/.test(message.toLowerCase()));

  const truthEvidence = useOpportunityOnly
    ? []
    : await retrieveTruthEvidence(message, context.chunks, context.session.sourceManifest, 4);
  const opportunityEvidence = useTruthOnly
    ? []
    : await retrieveOpportunityEvidence(
        message,
        context.chunks,
        context.session.sourceManifest,
        4
      );
  const evidence = [...truthEvidence, ...opportunityEvidence];

  if (!hasModelConfig()) {
    return {
      content: evidence.length
        ? `I found relevant grounded evidence in ${summarizeEvidenceTitles(evidence)}, but Featherless isn't configured in this workspace yet. Add FEATHERLESS_API_KEY to .env, restart the app, and ask again for a conversational answer.`
        : "Featherless isn't configured in this workspace yet. Add FEATHERLESS_API_KEY to .env, restart the app, and then ask again.",
      sourceRefs: uniqueSourceRefs(evidenceToRefs(evidence))
    };
  }

  if (!evidence.length) {
    return {
      content:
        "I couldn't find grounded evidence for that yet. Add a more relevant source or ask a narrower question and I'll re-check.",
      sourceRefs: [] as EvidenceRef[]
    };
  }

  const prompt = [
    "You are SupervisorAgent for CareerFlow AI.",
    "Answer the user's question using only the grounded evidence below.",
    "Rules:",
    "- User facts can only come from truth-store evidence.",
    "- Role or company facts can only come from opportunity-store evidence.",
    "- If evidence is incomplete, say so clearly.",
    "- Keep the answer concise and conversational.",
    "",
    `User message: ${message}`,
    context.session.candidateProfile
      ? `Candidate profile: ${JSON.stringify(context.session.candidateProfile)}`
      : "",
    context.session.jobProfile
      ? `Job profile: ${JSON.stringify(context.session.jobProfile)}`
      : "",
    "",
    "Truth evidence:",
    ...truthEvidence.map(
      (item) => `- ${item.title} (${item.chunkId}): ${item.excerpt}`
    ),
    "",
    "Opportunity evidence:",
    ...opportunityEvidence.map(
      (item) => `- ${item.title} (${item.chunkId}): ${item.excerpt}`
    )
  ]
    .filter(Boolean)
    .join("\n");

  const fallback = () =>
    `I couldn't reach the Featherless model just now. Please try again in a moment. I did find relevant evidence in ${summarizeEvidenceTitles(
      evidence
    )}.`;

  const { text, usedModel, errorMessage } = await generateText(prompt, fallback);
  if (!usedModel && errorMessage && hasModelConfig()) {
    return {
      content: `I couldn't reach the Featherless model for this chat turn. ${errorMessage}`,
      sourceRefs: uniqueSourceRefs(evidenceToRefs(evidence))
    };
  }

  return {
    content: text,
    sourceRefs: uniqueSourceRefs(evidenceToRefs(evidence))
  };
}

export async function runSupervisorChat(input: {
  sessionId: string;
  message: string;
  explicitIntent?: string;
  addUserMessage?: boolean;
}): Promise<ChatResponse> {
  const storage = getStorage();
  const session = await storage.getSession(input.sessionId);

  if (!session) {
    throw new Error("Session not found.");
  }

  const chunks = await storage.getChunkIndex(input.sessionId);
  const context = buildContext(session, chunks);
  const message = input.message.trim();
  const intents = inferChatIntents(message, input.explicitIntent);
  const freshArtifacts: DraftArtifact[] = [];
  const responseParts: string[] = [];
  const gatheredSourceRefs: EvidenceRef[] = [];

  session.workflowTrace = [];

  if (input.addUserMessage !== false && message) {
    session.chatHistory.push(
      createChatMessage({
        role: "user",
        content: message,
        explicitIntent: input.explicitIntent
      })
    );
  }

  const missingRequirements = getMissingRequirements(session, intents);
  if (missingRequirements.length) {
    const assistantMessage = createChatMessage({
      role: "assistant",
      content: missingRequirements.join(" "),
      explicitIntent: input.explicitIntent
    });
    session.chatHistory.push(assistantMessage);
    session.updatedAt = new Date().toISOString();
    await storage.saveSession(session);
    return {
      session,
      assistantMessage,
      artifacts: [],
      workflowTrace: session.workflowTrace,
      sourceRefs: []
    };
  }

  if (
    intents.some((intent) =>
      [
        "analyze_match",
        "rewrite_resume",
        "draft_outreach",
        "interview_prep",
        "build_plan",
        "finalize_resume"
      ].includes(intent)
    )
  ) {
    await ensureCandidateProfile(context);
  }

  if (
    intents.some((intent) =>
      [
        "summarize_role",
        "analyze_match",
        "rewrite_resume",
        "draft_outreach",
        "interview_prep",
        "build_plan",
        "search_jobs",
        "finalize_resume"
      ].includes(intent)
    )
  ) {
    await ensureJobProfile(context);
  }

  let matchAlreadyRan = false;
  for (const intent of intents) {
    if (intent === "summarize_role") {
      if (context.session.jobProfile) {
        const { content, sourceRefs } = await composeGroundedAnswer(
          context,
          `Summarize the current role and company context. Original request: ${message}`,
          ["summarize_role"]
        );
        responseParts.push(content);
        gatheredSourceRefs.push(...sourceRefs);
      }
      continue;
    }

    if (intent === "analyze_match") {
      const matchResult = await runMatchAgent(context);
      context.session.matchReport = matchResult.matchReport;
      appendMatchReportSnapshot(context.session, matchResult.matchReport);
      replaceArtifacts(context.session, [matchResult.artifact]);
      freshArtifacts.push(matchResult.artifact);
      gatheredSourceRefs.push(...matchResult.artifact.sourceRefs);
      responseParts.push(summarizeMatchArtifact(context.session));
      matchAlreadyRan = true;
      continue;
    }

    if (intent === "rewrite_resume") {
      if (!matchAlreadyRan && context.session.candidateProfile && context.session.jobProfile) {
        const matchResult = await runMatchAgent(context);
        context.session.matchReport = matchResult.matchReport;
        appendMatchReportSnapshot(context.session, matchResult.matchReport);
        replaceArtifacts(context.session, [matchResult.artifact]);
        matchAlreadyRan = true;
      }

      const artifacts = await runApplicationWriterAgent(context, {
        instruction: message,
        focus: ["resume_rewrite"]
      });
      replaceArtifacts(context.session, artifacts);
      freshArtifacts.push(...artifacts);
      gatheredSourceRefs.push(...artifacts.flatMap((artifact) => artifact.sourceRefs));
      responseParts.push(
        "I rewrote your resume using only current truth-store evidence and the active opportunity sources. The tailored resume block is attached below."
      );
      continue;
    }

    if (intent === "finalize_resume") {
      if (!matchAlreadyRan && context.session.candidateProfile && context.session.jobProfile) {
        const matchResult = await runMatchAgent(context);
        context.session.matchReport = matchResult.matchReport;
        appendMatchReportSnapshot(context.session, matchResult.matchReport);
        replaceArtifacts(context.session, [matchResult.artifact]);
        matchAlreadyRan = true;
      }

      const artifacts = await runApplicationWriterAgent(context, {
        instruction: message || "Finalize ATS version.",
        mode: "ats",
        focus: ["ats_resume"]
      });
      replaceArtifacts(context.session, artifacts);
      freshArtifacts.push(...artifacts);
      gatheredSourceRefs.push(...artifacts.flatMap((artifact) => artifact.sourceRefs));
      responseParts.push(
        "I created a tighter ATS-ready version anchored to your current evidence and the active role sources."
      );
      continue;
    }

    if (intent === "draft_outreach") {
      const artifacts = await runApplicationWriterAgent(context, {
        instruction: message,
        focus: ["outreach", "linkedin_note", "why_this_role"]
      });
      replaceArtifacts(context.session, artifacts);
      freshArtifacts.push(...artifacts);
      gatheredSourceRefs.push(...artifacts.flatMap((artifact) => artifact.sourceRefs));
      responseParts.push(
        "I drafted networking copy grounded in your current resume evidence and the role context. The outreach blocks are attached below."
      );
      continue;
    }

    if (intent === "interview_prep") {
      const artifact = await runInterviewPrepAgent(context, {
        instruction: message
      });
      replaceArtifacts(context.session, [artifact]);
      freshArtifacts.push(artifact);
      gatheredSourceRefs.push(...artifact.sourceRefs);
      responseParts.push(
        "I generated interview questions and talking points tied back to your current experience evidence."
      );
      continue;
    }

    if (intent === "build_plan") {
      const result = await runPlannerAgent(context, {
        instruction: message
      });
      replaceArtifacts(context.session, [result.artifact]);
      context.session.notes = [result.sessionSummary];
      freshArtifacts.push(result.artifact);
      gatheredSourceRefs.push(...result.artifact.sourceRefs);
      responseParts.push(
        "I built a next-step plan based on the sources currently loaded in this session."
      );
      continue;
    }

    if (intent === "search_jobs") {
      const provider = getJobDiscoveryProvider();
      const query =
        context.session.jobProfile?.title ||
        context.session.jobProfile?.keywords.join(" ") ||
        message ||
        "AI internship";
      const results = await provider.searchJobs(query);
      context.session.jobSearchResults = results;
      responseParts.push(summarizeSearchResults(results.length));
      continue;
    }

    if (intent === "general_qa") {
      const result = await composeGroundedAnswer(context, message, intents);
      responseParts.push(result.content);
      gatheredSourceRefs.push(...result.sourceRefs);
    }
  }

  const assistantMessage = createChatMessage({
    role: "assistant",
    content:
      responseParts.join("\n\n") ||
      "I checked the current session and I'm ready for a more specific question.",
    explicitIntent: input.explicitIntent,
    sourceRefs: uniqueSourceRefs(gatheredSourceRefs),
    artifactIds: freshArtifacts.map((artifact) => artifact.id)
  });

  session.chatHistory.push(assistantMessage);
  session.updatedAt = new Date().toISOString();
  await storage.saveSession(session);

  return {
    session,
    assistantMessage,
    artifacts: freshArtifacts,
    workflowTrace: session.workflowTrace,
    sourceRefs: assistantMessage.sourceRefs
  };
}

import type {
  ChatResponse,
  DraftArtifact,
  EvidenceRef,
  SessionRecord
} from "@/lib/schemas";
import type { JobSpySearchFilters } from "@/lib/mcp/jobspy/types";
import { getStorage } from "@/lib/storage";
import { generateText } from "@/lib/tools/model";
import {
  retrieveOpportunityEvidence,
  retrieveTruthEvidence,
  type RetrievedEvidence
} from "@/lib/tools/retrieval";
import {
  createChatMessage,
  getActiveResumeSource,
  getSelectedOpportunitySource,
  getSessionSources
} from "@/lib/tools/session-state";
import { buildAgentContext, makeTraceStep } from "@/lib/agents/shared";

import { requestCrewAiPlan } from "./integrations/crewai-planner";
import { runEmailConnectAgent } from "./workers/outreach";
import { deriveSearchQuery, saveSelectedJobToSession, searchJobs } from "./workers/job-search";
import { runMatchOptimizeAgent } from "./workers/match-optimize";
import { ensureParsedSessionState } from "./workers/source-ingest";

type OrchestratorIntent =
  | "parse_sources"
  | "search_jobs"
  | "save_job"
  | "analyze_match"
  | "optimize_resume"
  | "draft_email"
  | "draft_connection_message"
  | "draft_cover_letter"
  | "general_grounded_qa";

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

function mapExplicitIntent(explicitIntent?: string): OrchestratorIntent[] {
  switch (explicitIntent) {
    case "parse_sources":
      return ["parse_sources"];
    case "search_jobs":
      return ["search_jobs"];
    case "save_job":
      return ["save_job"];
    case "analyze_match":
      return ["analyze_match"];
    case "rewrite_resume":
    case "finalize_resume":
    case "optimize_resume":
      return ["optimize_resume"];
    case "draft_outreach":
    case "draft_email":
      return ["draft_email"];
    case "draft_connection_message":
      return ["draft_connection_message"];
    case "draft_cover_letter":
      return ["draft_cover_letter"];
    case "generate_interview_prep":
    case "build_plan":
      return ["general_grounded_qa"];
    default:
      return [];
  }
}

function inferIntents(message: string, explicitIntent?: string): OrchestratorIntent[] {
  const explicit = mapExplicitIntent(explicitIntent);
  if (explicit.length) {
    return explicit;
  }

  const lowered = message.toLowerCase();
  const intents = new Set<OrchestratorIntent>();
  const mentionsResume = /\b(resume|cv)\b/.test(lowered);
  const asksToModifyResume =
    /(optimize|tailor|rewrite|revise|change|update|improve|edit|fix|refine|adjust)/.test(
      lowered
    ) && mentionsResume;
  const asksForResumeTargeting =
    mentionsResume &&
    /(for|toward|target(?:ed|ing)?|fit for|match for).*(job|role|internship|posting|opportunity)/.test(
      lowered
    );

  if (/(parse|reparse|ingest).*(resume|source|sources|job description|job posting)/.test(lowered)) {
    intents.add("parse_sources");
  }
  if (/(find|search).*(job|jobs|role|roles|internship|internships)/.test(lowered)) {
    intents.add("search_jobs");
  }
  if (/\bsave\b.*(job|role|listing)/.test(lowered)) {
    intents.add("save_job");
  }
  if (/(fit|match|gap|qualified|should i apply|am i a fit)/.test(lowered)) {
    intents.add("analyze_match");
  }
  if (/(optimize|tailor|rewrite).*(resume|cv)|ats/.test(lowered) || asksToModifyResume || asksForResumeTargeting) {
    intents.add("optimize_resume");
  }
  if (/(email|outreach|follow-up|follow up|recruiter)/.test(lowered)) {
    intents.add("draft_email");
  }
  if (/(linkedin|connection message|connect note|connection note)/.test(lowered)) {
    intents.add("draft_connection_message");
  }
  if (/(cover letter|application letter)/.test(lowered)) {
    intents.add("draft_cover_letter");
  }

  if (!intents.size) {
    intents.add("general_grounded_qa");
  }

  const order: OrchestratorIntent[] = [
    "parse_sources",
    "search_jobs",
    "save_job",
    "analyze_match",
    "optimize_resume",
    "draft_email",
    "draft_connection_message",
    "draft_cover_letter",
    "general_grounded_qa"
  ];

  return Array.from(intents).sort((left, right) => order.indexOf(left) - order.indexOf(right));
}

async function resolveIntents(input: {
  session: SessionRecord;
  message: string;
  explicitIntent?: string;
  selectedJobId?: string;
  selectedResumeSourceId?: string;
  selectedSourceId?: string;
  selectedSourceIds?: string[];
}) {
  const fallbackIntents = inferIntents(input.message, input.explicitIntent);

  if (input.explicitIntent) {
    return {
      intents: fallbackIntents,
      planner: "explicit"
    } as const;
  }

  const bridged = await requestCrewAiPlan({
    session: input.session,
    message: input.message,
    explicitIntent: input.explicitIntent,
    selectedJobId: input.selectedJobId,
    selectedResumeSourceId: input.selectedResumeSourceId,
    selectedSourceId: input.selectedSourceId,
    selectedSourceIds: input.selectedSourceIds,
    fallbackIntents
  });

  if (bridged?.intents.length) {
    return {
      intents: bridged.intents as OrchestratorIntent[],
      planner: "crewai",
      explanation: bridged.explanation
    } as const;
  }

  return {
    intents: fallbackIntents,
    planner: "local"
  } as const;
}

function isGreeting(message: string) {
  return /^(hi|hello|hey|yo|good morning|good afternoon|good evening)\b[!. ]*$/i.test(
    message.trim()
  );
}

function isSourceInventoryQuestion(message: string) {
  return /(what|which|show|list).*(source|sources|resume|job description|uploaded)/i.test(
    message
  );
}

function isSavedJobsQuestion(message: string) {
  return /(saved jobs|job results|searched jobs|saved roles|summarize the saved jobs)/i.test(
    message
  );
}

function answerSourceInventoryQuestion(session: SessionRecord) {
  const sources = getSessionSources(session);
  const truthSources = sources.filter((source) => source.kind === "truth");
  const opportunitySources = sources.filter((source) => source.kind === "opportunity");
  const activeResume = getActiveResumeSource(session);
  const selectedOpportunity = getSelectedOpportunitySource(session);

  return {
    content: [
      activeResume ? `Active resume: ${activeResume.title}.` : "No active resume is set.",
      selectedOpportunity
        ? `Selected opportunity: ${selectedOpportunity.title}.`
        : "No selected opportunity is set.",
      `Truth sources: ${truthSources.length ? truthSources.map((source) => source.title).join(", ") : "none"}.`,
      `Opportunity sources: ${opportunitySources.length ? opportunitySources.map((source) => source.title).join(", ") : "none"}.`
    ].join(" "),
    sourceRefs: [] as EvidenceRef[]
  };
}

function answerSavedJobsQuestion(session: SessionRecord) {
  const results = session.savedJobSearchResults;
  if (!results.length) {
    return {
      content: "No job search results are currently saved in this session.",
      sourceRefs: [] as EvidenceRef[]
    };
  }

  return {
    content: `You currently have ${results.length} saved search result${
      results.length === 1 ? "" : "s"
    }: ${results
      .slice(0, 5)
      .map((job) => `${job.title} at ${job.company}${job.savedSourceId ? " (saved to sources)" : ""}`)
      .join("; ")}.`,
    sourceRefs: [] as EvidenceRef[]
  };
}

function inferSelectedJobId(message: string, session: SessionRecord) {
  const directId = session.savedJobSearchResults.find((job) =>
    message.toLowerCase().includes(job.id.toLowerCase())
  );
  if (directId) {
    return directId.id;
  }

  const numberMatch = message.match(/\b(\d+)(st|nd|rd|th)?\b/);
  if (numberMatch) {
    const index = Number(numberMatch[1]) - 1;
    if (session.savedJobSearchResults[index]) {
      return session.savedJobSearchResults[index].id;
    }
  }

  const ordinals = [
    ["first", 0],
    ["second", 1],
    ["third", 2],
    ["fourth", 3],
    ["fifth", 4]
  ] as const;
  const ordinal = ordinals.find(([label]) => message.toLowerCase().includes(label));
  return ordinal ? session.savedJobSearchResults[ordinal[1]]?.id : undefined;
}

function getMissingRequirements(session: SessionRecord, intents: OrchestratorIntent[]) {
  const needsTruth = intents.some((intent) =>
    [
      "analyze_match",
      "optimize_resume",
      "draft_email",
      "draft_connection_message",
      "draft_cover_letter"
    ].includes(
      intent
    )
  );
  const needsOpportunity = intents.some((intent) =>
    [
      "analyze_match",
      "optimize_resume",
      "draft_email",
      "draft_connection_message",
      "draft_cover_letter"
    ].includes(
      intent
    )
  );
  const missing: string[] = [];

  if (needsTruth && !getActiveResumeSource(session)) {
    missing.push("Add or set an active resume first.");
  }
  if (needsOpportunity && !getSelectedOpportunitySource(session)) {
    missing.push("Save or add an opportunity source first.");
  }
  if (!getSessionSources(session).length) {
    missing.push("Add at least one source to this session first.");
  }

  return missing;
}

async function answerGroundedQuestion(
  session: SessionRecord,
  message: string,
  sourceRefs: RetrievedEvidence[],
  context?: ReturnType<typeof buildAgentContext>
) {
  if (isGreeting(message)) {
    return {
      content:
        "Hi! I can parse sources, search jobs, save a selected role, analyze match, optimize your resume, and draft grounded outreach.",
      sourceRefs: [] as EvidenceRef[]
    };
  }

  if (isSourceInventoryQuestion(message)) {
    return answerSourceInventoryQuestion(session);
  }

  if (isSavedJobsQuestion(message)) {
    return answerSavedJobsQuestion(session);
  }

  const useTruthOnly =
    /(my|me|i |resume|skills|background|experience)/i.test(message) &&
    !/(job|company|role|posting|saved jobs)/i.test(message);
  const useOpportunityOnly =
    /(job|company|role|posting|saved jobs|requirements)/i.test(message) &&
    !/(my|me|i |resume|skills|background|experience)/i.test(message);

  const storage = getStorage();
  const chunks = await storage.getChunkIndex(session.id);
  const truthEvidence = useOpportunityOnly
    ? []
    : await retrieveTruthEvidence(message, chunks, session.sourceManifest, 4);
  const opportunityEvidence = useTruthOnly
    ? []
    : await retrieveOpportunityEvidence(message, chunks, session.sourceManifest, 4);
  const evidence = [...truthEvidence, ...opportunityEvidence];

  if (!evidence.length) {
    return {
      content:
        "I couldn't find grounded evidence for that question yet. Add a more relevant source or ask a narrower question.",
      sourceRefs: [] as EvidenceRef[]
    };
  }

  const prompt = [
    "You are OrchestratorAgent for CareerFlow AI.",
    "Answer the user's question using only the grounded evidence below.",
    "Rules:",
    "- User facts can only come from truth evidence.",
    "- Role and company facts can only come from opportunity evidence.",
    "- If evidence is incomplete, say so directly.",
    "- Keep the answer concise and conversational.",
    "",
    `User message: ${message}`,
    session.parsedResumeProfile
      ? `Parsed resume profile: ${JSON.stringify(session.parsedResumeProfile)}`
      : "",
    session.selectedOpportunityProfile
      ? `Selected opportunity profile: ${JSON.stringify(session.selectedOpportunityProfile)}`
      : "",
    "",
    "Truth evidence:",
    ...truthEvidence.map((item) => `- ${item.title} (${item.chunkId}): ${item.text}`),
    "",
    "Opportunity evidence:",
    ...opportunityEvidence.map((item) => `- ${item.title} (${item.chunkId}): ${item.text}`)
  ]
    .filter(Boolean)
    .join("\n");

  const generated = await generateText(prompt, () =>
    `I found grounded evidence in ${Array.from(new Set(evidence.map((item) => item.title)))
      .slice(0, 3)
      .join(", ")}, but I need a more specific question to answer confidently.`
  );

  sourceRefs.push(...evidence);
  context?.updateTrace(
    makeTraceStep(
      "OrchestratorAgent",
      "Answered a grounded session question using retrieved evidence.",
      "completed",
      [],
      [
        ...(truthEvidence.length ? ["retrieveTruthEvidence"] : []),
        ...(opportunityEvidence.length ? ["retrieveOpportunityEvidence"] : []),
        "generateText"
      ]
    )
  );
  return {
    content: generated.text,
    sourceRefs: uniqueSourceRefs(evidenceToRefs(evidence))
  };
}

function splitSelectedSourceIds(session: SessionRecord, sourceIds?: string[]) {
  const selected = new Set((sourceIds ?? []).filter(Boolean));
  return {
    truthSourceIds: getSessionSources(session)
      .filter((source) => selected.has(source.id) && source.kind === "truth")
      .map((source) => source.id),
    opportunitySourceIds: getSessionSources(session)
      .filter((source) => selected.has(source.id) && source.kind === "opportunity")
      .map((source) => source.id)
  };
}

function orchestratorToolsForIntent(intent: OrchestratorIntent) {
  switch (intent) {
    case "parse_sources":
      return ["ensureParsedSessionState", "parseResume", "parseJobDescription"];
    case "search_jobs":
      return ["deriveSearchQuery", "JobSpyMcp.searchJobs"];
    case "save_job":
      return ["saveSelectedJobToSession", "DecodoMcp.extractStructuredText"];
    case "analyze_match":
      return ["ensureParsedSessionState", "compareCandidateToJob"];
    case "optimize_resume":
      return [
        "ensureParsedSessionState",
        "compareCandidateToJob",
        "retrieveTruthEvidence",
        "retrieveOpportunityEvidence",
        "generateText"
      ];
    case "draft_email":
    case "draft_connection_message":
    case "draft_cover_letter":
      return [
        "ensureParsedSessionState",
        "retrieveTruthEvidence",
        "retrieveOpportunityEvidence",
        "generateText"
      ];
    default:
      return ["retrieveTruthEvidence", "retrieveOpportunityEvidence", "generateText"];
  }
}

export async function runOrchestratorChat(input: {
  sessionId: string;
  message: string;
  explicitIntent?: string;
  selectedJobId?: string;
  selectedResumeSourceId?: string;
  selectedSourceId?: string;
  selectedSourceIds?: string[];
  filters?: JobSpySearchFilters;
  addUserMessage?: boolean;
}): Promise<ChatResponse> {
  const storage = getStorage();
  let session = await storage.getSession(input.sessionId);

  if (!session) {
    throw new Error("Session not found.");
  }

  let chunks = await storage.getChunkIndex(input.sessionId);
  let context = buildAgentContext(session, chunks);
  const message = input.message.trim();
  const routing = await resolveIntents({
    session,
    message,
    explicitIntent: input.explicitIntent,
    selectedJobId: input.selectedJobId,
    selectedResumeSourceId: input.selectedResumeSourceId,
    selectedSourceId: input.selectedSourceId,
    selectedSourceIds: input.selectedSourceIds
  });
  const intents = routing.intents;
  const responseParts: string[] = [];
  const gatheredSourceRefs: RetrievedEvidence[] = [];
  const freshArtifacts: DraftArtifact[] = [];

  session.workflowTrace = [];

  if (routing.planner === "crewai") {
    context.updateTrace(
      makeTraceStep(
        "OrchestratorAgent",
        routing.explanation
          ? `CrewAI planner suggested ${intents.join(", ")}. ${routing.explanation}`
          : `CrewAI planner suggested ${intents.join(", ")}.`,
        "completed",
        [],
        ["CrewAIBridge.plan"]
      )
    );
  } else if (routing.planner === "local" && !input.explicitIntent) {
    context.updateTrace(
      makeTraceStep(
        "OrchestratorAgent",
        `Local intent rules suggested ${intents.join(", ")}.`,
        "completed",
        [],
        ["inferIntents"]
      )
    );
  }

  if (input.addUserMessage !== false && message) {
    session.chatHistory.push(
      createChatMessage({
        role: "user",
        content: message,
        explicitIntent: input.explicitIntent
      })
    );
  }

  const missingRequirements = getMissingRequirements(session, intents).filter(
    (value, index, list) => list.indexOf(value) === index
  );
  if (missingRequirements.length && !intents.includes("search_jobs")) {
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

  for (const intent of intents) {
    context.updateTrace(
      makeTraceStep(
        "OrchestratorAgent",
        `Routing "${intent.replaceAll("_", " ")}" to the right worker flow.`,
        "completed",
        [],
        orchestratorToolsForIntent(intent)
      )
    );

    if (intent === "parse_sources") {
      const selected = splitSelectedSourceIds(session, input.selectedSourceIds);
      const result = await ensureParsedSessionState(context, {
        preferredResumeSourceId: input.selectedResumeSourceId,
        preferredOpportunitySourceId: input.selectedSourceId,
        truthSourceIds: selected.truthSourceIds,
        opportunitySourceIds: selected.opportunitySourceIds
      });
      freshArtifacts.push(...result.artifacts);
      responseParts.push(
        result.parsedResumeProfile
          ? "I reparsed the current sources and refreshed the grounded resume/opportunity state."
          : "I checked the current sources, but I still need an active resume to parse candidate facts."
      );
      continue;
    }

    if (intent === "search_jobs") {
      const query = deriveSearchQuery(session, message);
      const result = await searchJobs(context, { query, filters: input.filters });
      freshArtifacts.push(result.artifact);
      responseParts.push(
        result.results.length
          ? `I found ${result.results.length} job result${
              result.results.length === 1 ? "" : "s"
            } for "${query}". Review them in the right rail and save the ones you want to ground against.`
          : `I couldn't find jobs for "${query}" just now.`
      );
      continue;
    }

    if (intent === "save_job") {
      const selectedJobId =
        input.selectedJobId ?? inferSelectedJobId(message, session);
      if (!selectedJobId) {
        responseParts.push(
          "Tell me which job to save, for example by clicking Save on a result or saying 'save the third role'."
        );
        continue;
      }

      const saved = await saveSelectedJobToSession(session.id, selectedJobId);
      session = saved.session;
      chunks = await storage.getChunkIndex(session.id);
      context = buildAgentContext(session, chunks);
      responseParts.push(
        `${saved.source.title} is now saved into the opportunity corpus and ready for matching or email drafting.`
      );
      continue;
    }

    if (intent === "analyze_match") {
      const result = await runMatchOptimizeAgent(context, {
        mode: "match",
        instruction: message,
        selectedResumeSourceId: input.selectedResumeSourceId,
        selectedSourceId: input.selectedSourceId
      });
      freshArtifacts.push(...result.artifacts);
      responseParts.push(result.summary);
      continue;
    }

    if (intent === "optimize_resume") {
      const result = await runMatchOptimizeAgent(context, {
        mode: "optimize",
        instruction: message,
        selectedResumeSourceId: input.selectedResumeSourceId,
        selectedSourceId: input.selectedSourceId
      });
      freshArtifacts.push(...result.artifacts);
      responseParts.push(result.summary);
      continue;
    }

    if (intent === "draft_email") {
      const result = await runEmailConnectAgent(context, {
        mode: "email",
        instruction: message,
        selectedResumeSourceId: input.selectedResumeSourceId,
        selectedSourceId: input.selectedSourceId
      });
      freshArtifacts.push(result.artifact);
      responseParts.push(result.summary);
      continue;
    }

    if (intent === "draft_connection_message") {
      const result = await runEmailConnectAgent(context, {
        mode: "connection",
        instruction: message,
        selectedResumeSourceId: input.selectedResumeSourceId,
        selectedSourceId: input.selectedSourceId
      });
      freshArtifacts.push(result.artifact);
      responseParts.push(result.summary);
      continue;
    }

    if (intent === "draft_cover_letter") {
      const result = await runEmailConnectAgent(context, {
        mode: "cover_letter",
        instruction: message,
        selectedResumeSourceId: input.selectedResumeSourceId,
        selectedSourceId: input.selectedSourceId
      });
      freshArtifacts.push(result.artifact);
      responseParts.push(result.summary);
      continue;
    }

    if (intent === "general_grounded_qa") {
      const grounded = await answerGroundedQuestion(
        session,
        message,
        gatheredSourceRefs,
        context
      );
      responseParts.push(grounded.content);
    }
  }

  const assistantMessage = createChatMessage({
    role: "assistant",
    content:
      responseParts.join("\n\n") ||
      "I checked the current session and I’m ready for a more specific request.",
    explicitIntent: input.explicitIntent,
    sourceRefs: uniqueSourceRefs(evidenceToRefs(gatheredSourceRefs)),
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

import type { AgentContext } from "@/lib/agents/shared";
import { makeTraceStep, upsertArtifact } from "@/lib/agents/shared";
import demoData from "@/data/sample/demo.json";
import { JobSpyMcpClient } from "@/lib/mcp/jobspy/client";
import type { JobSpySearchFilters } from "@/lib/mcp/jobspy/types";
import type { DraftArtifact, JobSearchResult, SessionRecord } from "@/lib/schemas";
import { getStorage } from "@/lib/storage";
import { makeId } from "@/lib/utils";
import { saveJobResultAsOpportunity } from "@/lib/agents/workers/source-ingest";
import { setSavedJobSearchResults } from "@/lib/tools/session-state";

function toJobSearchResult(input: {
  id: string;
  title: string;
  company: string;
  location: string;
  summary: string;
  url?: string;
  keywords?: string[];
  provider?: string;
}): JobSearchResult {
  return {
    id: input.id,
    title: input.title,
    company: input.company,
    location: input.location,
    summary: input.summary,
    url: input.url,
    keywords: input.keywords ?? [],
    provider: input.provider,
    selected: false,
    sourceRefs: []
  };
}

function buildSearchArtifact(results: JobSearchResult[]): DraftArtifact {
  const content = results.length
    ? results
        .map(
          (job, index) =>
            `${index + 1}. ${job.title} - ${job.company} (${job.location})\n${job.summary}${
              job.url ? `\nLink: ${job.url}` : ""
            }`
        )
        .join("\n\n")
    : "No job results are currently saved for this session.";

  return {
    id: makeId("artifact"),
    type: "saved_job_list",
    title: "Job Search Results",
    content,
    claimMap: [],
    sourceRefs: [],
    editable: false
  };
}

export function deriveSearchQuery(session: SessionRecord, message?: string) {
  const cleaned = (message ?? "")
    .replace(
      /\b(find|search|jobs|job|roles|role|internships|internship|like this|for me|please)\b/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned) {
    return cleaned;
  }

  if (session.selectedOpportunityProfile?.title) {
    return session.selectedOpportunityProfile.title;
  }

  if (session.jobProfile?.title) {
    return session.jobProfile.title;
  }

  return "software engineering internship";
}

function buildSeededFallbackResults(query: string): JobSearchResult[] {
  const keywords = query
    .split(/\s+/)
    .map((token) => token.toLowerCase())
    .filter(Boolean);

  return [
    toJobSearchResult({
      id: makeId("job"),
      title: "Applied AI Product Engineering Intern",
      company: "BrightPath Careers",
      location: "Remote",
      summary: demoData.jobDescription.slice(0, 240),
      url: demoData.jobUrl,
      keywords: ["TypeScript", "Next.js", "RAG", "Product", "AI"],
      provider: "manual"
    }),
    toJobSearchResult({
      id: makeId("job"),
      title: "Career Platform Engineer Intern",
      company: "LaunchLayer",
      location: "Chicago, IL",
      summary:
        "Build grounded job-search and resume-tailoring workflows for student users.",
      url: "https://example.com/jobs/career-platform-engineer-intern",
      keywords: ["React", "LLMs", "Grounding", "Analytics", ...keywords.slice(0, 2)],
      provider: "manual"
    }),
    toJobSearchResult({
      id: makeId("job"),
      title: "AI Workflow Product Intern",
      company: "SignalSpring",
      location: "Hybrid",
      summary:
        "Prototype product experiences that combine retrieval, workflow orchestration, and strong UX.",
      url: "https://example.com/jobs/ai-workflow-product-intern",
      keywords: ["Next.js", "Product", "Evaluation", ...keywords.slice(0, 2)],
      provider: "manual"
    })
  ];
}

export async function searchJobs(
  context: AgentContext,
  input: {
    query: string;
    filters?: JobSpySearchFilters;
  }
) {
  const jobSpy = new JobSpyMcpClient();
  let results: JobSearchResult[] = [];
  let providerLabel = "JobSpy MCP";

  if (jobSpy.isConfigured()) {
    try {
      const items = await jobSpy.searchJobs(input.query, input.filters);
      results = items.map((item) =>
        toJobSearchResult({
          ...item,
          provider: item.provider
        })
      );
    } catch {
      providerLabel = "manual fallback";
    }
  } else {
    providerLabel = "manual fallback";
  }

  if (!results.length) {
    results = buildSeededFallbackResults(input.query);
  }

  setSavedJobSearchResults(context.session, results);
  const artifact = buildSearchArtifact(results);
  upsertArtifact(context.session.artifacts, artifact);
  context.updateTrace(
    makeTraceStep(
      "JobSearchAgent",
      `Searched for jobs using ${providerLabel} and stored ${results.length} result${results.length === 1 ? "" : "s"}.`,
      "completed",
      [artifact.id],
      [
        providerLabel === "manual fallback"
          ? "ManualJobDiscoveryProvider.searchJobs"
          : "JobSpyMcp.searchJobs",
        "setSavedJobSearchResults"
      ]
    )
  );

  return {
    results,
    artifact
  };
}

export async function saveSelectedJobToSession(sessionId: string, jobId: string) {
  const storage = getStorage();
  const session = await storage.getSession(sessionId);

  if (!session) {
    throw new Error("Session not found.");
  }

  const selected = session.savedJobSearchResults.find((job) => job.id === jobId);
  if (!selected) {
    throw new Error("Job result not found in this session.");
  }

  return saveJobResultAsOpportunity(sessionId, selected);
}

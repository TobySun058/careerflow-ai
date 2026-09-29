import { getEnv } from "@/lib/config";
import type { SessionRecord } from "@/lib/schemas";
import {
  getActiveResumeSource,
  getSelectedOpportunitySource,
  getSessionSources
} from "@/lib/tools/session-state";

const ALLOWED_INTENTS = [
  "parse_sources",
  "search_jobs",
  "save_job",
  "analyze_match",
  "optimize_resume",
  "draft_email",
  "draft_connection_message",
  "draft_cover_letter",
  "general_grounded_qa"
] as const;

type AllowedIntent = (typeof ALLOWED_INTENTS)[number];

type CrewAIPlanResult = {
  intents: AllowedIntent[];
  explanation?: string;
};

function isAllowedIntent(value: string): value is AllowedIntent {
  return (ALLOWED_INTENTS as readonly string[]).includes(value);
}

function trimList(values: string[], limit = 8) {
  return values.filter(Boolean).slice(0, limit);
}

function buildSessionSnapshot(session: SessionRecord) {
  const sources = getSessionSources(session);
  const activeResume = getActiveResumeSource(session);
  const selectedOpportunity = getSelectedOpportunitySource(session);

  return {
    id: session.id,
    title: session.title,
    activeResumeSourceId: session.activeResumeSourceId,
    selectedOpportunitySourceId: session.selectedOpportunitySourceId,
    hasParsedResumeProfile: Boolean(session.parsedResumeProfile),
    hasSelectedOpportunityProfile: Boolean(session.selectedOpportunityProfile),
    activeResumeTitle: activeResume?.title ?? null,
    selectedOpportunityTitle: selectedOpportunity?.title ?? null,
    sources: sources.map((source) => ({
      id: source.id,
      title: source.title,
      kind: source.kind,
      type: source.type,
      active: source.active,
      provider: source.metadata.provider ?? null
    })),
    artifacts: session.artifacts.map((artifact) => ({
      id: artifact.id,
      type: artifact.type,
      title: artifact.title
    })),
    savedJobSearchResults: session.savedJobSearchResults.map((job) => ({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      savedSourceId: job.savedSourceId ?? null
    })),
    notes: trimList(session.notes, 6)
  };
}

export function isCrewAiBridgeConfigured() {
  const env = getEnv();
  return env.enableCrewAiBridge && Boolean(env.crewaiBridgeUrl);
}

export async function requestCrewAiPlan(input: {
  session: SessionRecord;
  message: string;
  explicitIntent?: string;
  selectedJobId?: string;
  selectedResumeSourceId?: string;
  selectedSourceId?: string;
  selectedSourceIds?: string[];
  fallbackIntents: string[];
}): Promise<CrewAIPlanResult | null> {
  if (!isCrewAiBridgeConfigured()) {
    return null;
  }

  const env = getEnv();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.max(1000, env.crewaiBridgeTimeoutMs)
  );

  try {
    const response = await fetch(`${env.crewaiBridgeUrl}/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: input.message,
        explicitIntent: input.explicitIntent,
        selectedJobId: input.selectedJobId,
        selectedResumeSourceId: input.selectedResumeSourceId,
        selectedSourceId: input.selectedSourceId,
        selectedSourceIds: input.selectedSourceIds ?? [],
        fallbackIntents: input.fallbackIntents,
        allowedIntents: ALLOWED_INTENTS,
        session: buildSessionSnapshot(input.session)
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      handled?: boolean;
      intents?: string[];
      explanation?: string;
    };

    if (payload.handled === false) {
      return null;
    }

    const intents = Array.isArray(payload.intents)
      ? payload.intents.filter(isAllowedIntent)
      : [];

    if (!intents.length) {
      return null;
    }

    return {
      intents,
      explanation:
        typeof payload.explanation === "string" && payload.explanation.trim()
          ? payload.explanation.trim()
          : undefined
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

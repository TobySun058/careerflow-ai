"use client";

import { Download, Loader2, Save } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import type { ChatMessage, SessionRecord } from "@/lib/schemas";

import { ActionRail } from "@/components/actions/action-rail";
import type { ActionRunConfig } from "@/components/actions/action-run-dialog";
import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { NotebookShell } from "@/components/layout/notebook-shell";
import { SourcesPanel } from "@/components/sources/sources-panel";
import { Button } from "@/components/ui/button";

type PendingTraceState = {
  agent: string;
  summary: string;
  mcps: string[];
  tools: string[];
} | null;

function buildPendingTraceForAction(action: string): PendingTraceState {
  switch (action) {
    case "parse_sources":
      return {
        agent: "OrchestratorAgent -> ParseIngestAgent",
        summary: "Re-parsing the selected sources and rebuilding grounded session state.",
        mcps: ["Decodo MCP"],
        tools: ["ensureParsedSessionState", "parseResume", "parseJobDescription"]
      };
    case "analyze_match":
      return {
        agent: "OrchestratorAgent -> MatchOptimizeAgent",
        summary: "Comparing the selected resume and opportunity.",
        mcps: [],
        tools: ["ensureParsedSessionState", "compareCandidateToJob"]
      };
    case "optimize_resume":
      return {
        agent: "OrchestratorAgent -> MatchOptimizeAgent",
        summary: "Scoring the match and generating targeted resume edit guidance.",
        mcps: [],
        tools: [
          "ensureParsedSessionState",
          "compareCandidateToJob",
          "retrieveTruthEvidence",
          "retrieveOpportunityEvidence",
          "generateText"
        ]
      };
    case "draft_email":
      return {
        agent: "OrchestratorAgent -> EmailConnectAgent",
        summary: "Drafting a grounded email from the selected resume and opportunity.",
        mcps: [],
        tools: ["retrieveTruthEvidence", "retrieveOpportunityEvidence", "generateText"]
      };
    case "draft_connection_message":
      return {
        agent: "OrchestratorAgent -> EmailConnectAgent",
        summary: "Drafting a grounded connection message.",
        mcps: [],
        tools: ["retrieveTruthEvidence", "retrieveOpportunityEvidence", "generateText"]
      };
    case "draft_cover_letter":
      return {
        agent: "OrchestratorAgent -> EmailConnectAgent",
        summary: "Drafting a grounded cover letter.",
        mcps: [],
        tools: ["retrieveTruthEvidence", "retrieveOpportunityEvidence", "generateText"]
      };
    case "search_jobs":
      return {
        agent: "OrchestratorAgent -> JobSearchAgent",
        summary: "Searching for jobs using the selected direction and filters.",
        mcps: ["JobSpy MCP"],
        tools: ["deriveSearchQuery", "JobSpyMcp.searchJobs"]
      };
    default:
      return {
        agent: "OrchestratorAgent",
        summary: "Routing the requested action.",
        mcps: [],
        tools: ["inferIntents"]
      };
  }
}

function buildPendingTraceForSource(endpoint: string): PendingTraceState {
    if (endpoint.includes("replace-resume")) {
      return {
        agent: "ParseIngestAgent",
        summary: "Setting or replacing the active resume and rebuilding grounded state.",
        mcps: [],
        tools: ["extractTextFromUpload", "rebuildSessionSourceState", "parseResume"]
      };
    }

    if (endpoint.includes("update")) {
      return {
        agent: "ParseIngestAgent",
        summary: "Updating the source, re-indexing it, and refreshing grounded outputs.",
        mcps: ["Decodo MCP"],
        tools: ["rebuildSessionSourceState", "parseResume", "parseJobDescription"]
      };
    }

  if (endpoint.includes("remove")) {
    return {
      agent: "ParseIngestAgent",
      summary: "Removing the source and rebuilding the affected session state.",
      mcps: [],
      tools: ["rebuildSessionSourceState", "parseResume", "parseJobDescription"]
    };
  }

  return {
    agent: "ParseIngestAgent",
    summary: "Adding a new source and indexing it into the session.",
    mcps: ["Decodo MCP"],
    tools: ["parseSourceFromFormData", "rebuildSessionSourceState", "parseResume"]
  };
}

function buildPendingTraceForChat(message: string): PendingTraceState {
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("cover letter") ||
    normalizedMessage.includes("connection message") ||
    normalizedMessage.includes("linkedin") ||
    normalizedMessage.includes("networking email") ||
    normalizedMessage.includes("outreach email") ||
    normalizedMessage.includes("email")
  ) {
    return buildPendingTraceForAction(
      normalizedMessage.includes("cover letter")
        ? "draft_cover_letter"
        : normalizedMessage.includes("connection") || normalizedMessage.includes("linkedin")
          ? "draft_connection_message"
          : "draft_email"
    );
  }

  if (
    normalizedMessage.includes("optimize") ||
    normalizedMessage.includes("tailor") ||
    normalizedMessage.includes("change the resume") ||
    normalizedMessage.includes("change my resume") ||
    normalizedMessage.includes("improve my resume") ||
    normalizedMessage.includes("update my resume") ||
    normalizedMessage.includes("edit my resume") ||
    normalizedMessage.includes("fix my resume") ||
    normalizedMessage.includes("rewrite my resume") ||
    normalizedMessage.includes("finalize resume")
  ) {
    return buildPendingTraceForAction("optimize_resume");
  }

  if (
    normalizedMessage.includes("match") ||
    normalizedMessage.includes("fit") ||
    normalizedMessage.includes("gap") ||
    normalizedMessage.includes("qualified") ||
    normalizedMessage.includes("qualification")
  ) {
    return buildPendingTraceForAction("analyze_match");
  }

  if (
    normalizedMessage.includes("find jobs") ||
    normalizedMessage.includes("search jobs") ||
    normalizedMessage.includes("find internships") ||
    normalizedMessage.includes("look for jobs") ||
    normalizedMessage.includes("look for internships")
  ) {
    return buildPendingTraceForAction("search_jobs");
  }

  if (
    normalizedMessage.includes("parse") ||
    normalizedMessage.includes("ingest") ||
    normalizedMessage.includes("re-parse")
  ) {
    return buildPendingTraceForAction("parse_sources");
  }

  return {
    agent: "OrchestratorAgent",
    summary: "Classifying your question, retrieving grounded evidence, and composing a response.",
    mcps: [],
    tools: ["inferIntents", "retrieveTruthEvidence", "retrieveOpportunityEvidence", "generateText"]
  };
}

export function WorkspaceShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") ?? "";

  const [session, setSession] = useState<SessionRecord | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [modelReady, setModelReady] = useState(true);
  const [pendingTrace, setPendingTrace] = useState<PendingTraceState>(null);

  async function refreshSessions() {
    const response = await fetch("/api/sessions");
    if (!response.ok) {
      return;
    }

    const body = (await response.json()) as { sessions: SessionRecord[] };
    setSessions(body.sessions);
  }

  async function fetchSession(targetId: string) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/session/${targetId}`);
      if (!response.ok) {
        throw new Error("Session not found.");
      }

      const body = (await response.json()) as {
        session: SessionRecord;
        modelReady?: boolean;
      };
      setSession(body.session);
      setModelReady(body.modelReady ?? true);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to load session."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshSessions();
  }, []);

  useEffect(() => {
    if (sessionId) {
      void fetchSession(sessionId);
    }
  }, [sessionId]);

  async function sendChatMessage(message: string) {
    const trimmedMessage = message.trim();
    if (!sessionId || !trimmedMessage) {
      return;
    }

    const optimisticMessage: ChatMessage = {
      id: `pending_${crypto.randomUUID()}`,
      role: "user",
      content: trimmedMessage,
      createdAt: new Date().toISOString(),
      sourceRefs: [],
      artifactIds: []
    };

    setSession((current) =>
      current
        ? {
            ...current,
            chatHistory: [...current.chatHistory, optimisticMessage],
            updatedAt: new Date().toISOString()
          }
        : current
    );
    setPending(true);
    setPendingTrace(buildPendingTraceForChat(trimmedMessage));
    setError("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: trimmedMessage })
      });
      const body = (await response.json()) as
        | { session: SessionRecord }
        | { error: string };

      if (!response.ok || !("session" in body)) {
        throw new Error("error" in body ? body.error : "Chat request failed.");
      }

      setSession(body.session);
      await refreshSessions();
    } catch (caughtError) {
      setSession((current) =>
        current
          ? {
              ...current,
              chatHistory: current.chatHistory.filter(
                (candidate) => candidate.id !== optimisticMessage.id
              )
            }
          : current
      );
      setError(caughtError instanceof Error ? caughtError.message : "Chat request failed.");
    } finally {
      setPending(false);
      setPendingTrace(null);
    }
  }

  async function runAction(action: string, config: ActionRunConfig) {
    if (!sessionId) {
      return;
    }

    setPending(true);
    setPendingTrace(buildPendingTraceForAction(action));
    setError("");
    try {
      const response = await fetch("/api/actions/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, action, ...config })
      });
      const body = (await response.json()) as
        | { session: SessionRecord }
        | { error: string };

      if (!response.ok || !("session" in body)) {
        throw new Error("error" in body ? body.error : "Action failed.");
      }

      setSession(body.session);
      await refreshSessions();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Action failed.");
    } finally {
      setPending(false);
      setPendingTrace(null);
    }
  }

  async function saveJobResult(jobId: string) {
    if (!sessionId) {
      return;
    }

    setPending(true);
    setPendingTrace({
      agent: "OrchestratorAgent -> ParseIngestAgent",
      summary: "Saving the selected job into the opportunity corpus.",
      mcps: ["Decodo MCP"],
      tools: ["saveSelectedJobToSession", "DecodoMcp.extractStructuredText", "rebuildSessionSourceState"]
    });
    setError("");
    try {
      const response = await fetch("/api/jobs/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, jobId })
      });
      const body = (await response.json()) as
        | { session: SessionRecord }
        | { error: string };

      if (!response.ok || !("session" in body)) {
        throw new Error("error" in body ? body.error : "Unable to save job.");
      }

      setSession(body.session);
      await refreshSessions();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to save job.");
    } finally {
      setPending(false);
      setPendingTrace(null);
    }
  }

  async function mutateSource(
    endpoint: string,
    body: FormData | Record<string, unknown>,
    kind: "formData" | "json" = "formData"
  ) {
    if (!sessionId) {
      return;
    }

    setPending(true);
    setPendingTrace(buildPendingTraceForSource(endpoint));
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: kind === "json" ? { "Content-Type": "application/json" } : undefined,
        body:
          kind === "json"
            ? JSON.stringify({ sessionId, ...body })
            : (() => {
                const formData = body as FormData;
                formData.append("sessionId", sessionId);
                return formData;
              })()
      });
      const payload = (await response.json()) as
        | { session: SessionRecord }
        | { error: string };

      if (!response.ok || !("session" in payload)) {
        throw new Error("error" in payload ? payload.error : "Source update failed.");
      }

      setSession(payload.session);
      await refreshSessions();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Source update failed."
      );
    } finally {
      setPending(false);
      setPendingTrace(null);
    }
  }

  async function updateSource(input: {
    sourceId: string;
    title: string;
    content: string;
  }) {
    await mutateSource("/api/sources/update", input, "json");
  }

  async function saveCurrentSession() {
    if (!session) {
      return;
    }

    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/save-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session })
      });
      if (!response.ok) {
        throw new Error("Save failed.");
      }
      await refreshSessions();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Save failed.");
    } finally {
      setPending(false);
    }
  }

  async function exportCurrentSession() {
    if (!sessionId) {
      return;
    }

    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, format: "pdf" })
      });
      if (!response.ok) {
        throw new Error("Export failed.");
      }

      const body = (await response.json()) as {
        filename: string;
        mimeType: string;
        content: string;
        encoding?: "base64";
      };
      const blob =
        body.encoding === "base64"
          ? new Blob(
              [
                Uint8Array.from(atob(body.content), (character) =>
                  character.charCodeAt(0)
                )
              ],
              { type: body.mimeType }
            )
          : new Blob([body.content], { type: body.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = body.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Export failed.");
    } finally {
      setPending(false);
    }
  }

  function updateArtifactContent(artifactId: string, nextContent: string) {
    setSession((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        artifacts: current.artifacts.map((artifact) =>
          artifact.id === artifactId ? { ...artifact, content: nextContent } : artifact
        ),
        plan:
          current.plan?.id === artifactId
            ? { ...current.plan, content: nextContent }
            : current.plan
      };
    });
  }

  async function selectSession(nextId: string) {
    if (!nextId || nextId === sessionId) {
      return;
    }

    router.push(`/workspace?sessionId=${nextId}`);
    await fetchSession(nextId);
    await refreshSessions();
  }

  async function renameSession(targetId: string, title: string) {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/session/${targetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title })
      });
      const body = (await response.json()) as
        | { session: SessionRecord; modelReady?: boolean }
        | { error: string };

      if (!response.ok || !("session" in body)) {
        throw new Error("error" in body ? body.error : "Rename failed.");
      }

      if (session?.id === targetId) {
        setSession(body.session);
        setModelReady(body.modelReady ?? true);
      }

      await refreshSessions();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Rename failed.");
    } finally {
      setPending(false);
    }
  }

  async function deleteSession(targetId: string) {
    const confirmed = window.confirm("Delete this saved session and its local source index?");
    if (!confirmed) {
      return;
    }

    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/session/${targetId}`, {
        method: "DELETE"
      });
      const body = (await response.json()) as
        | { deletedId: string }
        | { error: string };

      if (!response.ok || !("deletedId" in body)) {
        throw new Error("error" in body ? body.error : "Delete failed.");
      }

      const remainingSessions = sessions.filter((candidate) => candidate.id !== targetId);
      await refreshSessions();

      if (targetId === sessionId) {
        const nextSession = remainingSessions[0];
        if (nextSession) {
          router.push(`/workspace?sessionId=${nextSession.id}`);
          await fetchSession(nextSession.id);
        } else {
          setSession(null);
          router.push("/");
        }
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Delete failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="h-screen overflow-hidden px-4 py-4 lg:px-6 lg:py-5">
      <div className="mx-auto flex h-full max-w-[1600px] min-h-0 flex-col">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.6rem] border border-white/75 bg-white/70 p-4 shadow-panel backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-primary">
              CareerFlow AI
            </p>
            <h1 className="font-heading text-2xl font-semibold">
              Notebook-style career workspace
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => router.push("/")} variant="outline">
              New session
            </Button>
            <Button disabled={!session || pending} onClick={saveCurrentSession} variant="outline">
              <Save className="h-4 w-4" />
              Save
            </Button>
            <Button
              disabled={!session || pending}
              onClick={exportCurrentSession}
              variant="outline"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {!modelReady && sessionId ? (
          <div className="mb-4 rounded-2xl border border-amber-300/60 bg-amber-100/70 px-4 py-3 text-sm text-amber-900">
            Featherless is not configured in this workspace. Chat can still use local and
            MCP-backed fallbacks, but open-ended grounded generation will be better once
            `FEATHERLESS_API_KEY` is set and the app is restarted.
          </div>
        ) : null}

        {!sessionId ? (
          <div className="rounded-[2rem] border border-white/80 bg-white/75 p-10 text-center shadow-panel backdrop-blur">
            <p className="font-heading text-2xl font-semibold">Start from the intake page</p>
            <p className="mt-3 text-muted-foreground">
              Create a session with a resume or role source first, then the notebook
              workspace will load here.
            </p>
            <Button className="mt-6" onClick={() => router.push("/")}>
              Go to intake
            </Button>
          </div>
        ) : loading ? (
          <div className="rounded-[2rem] border border-white/80 bg-white/75 p-10 text-center shadow-panel backdrop-blur">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">Loading session...</p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-hidden">
            <NotebookShell
              center={
                <ChatWorkspace
                  artifacts={session?.artifacts ?? []}
                  messages={session?.chatHistory ?? []}
                  onArtifactChange={updateArtifactContent}
                  onSendMessage={sendChatMessage}
                  pending={pending}
                  pendingTrace={pendingTrace}
                />
              }
              left={
                <SourcesPanel
                  currentSessionId={session?.id}
                  onAddSource={(formData) => mutateSource("/api/sources/add", formData)}
                  onDeleteSession={deleteSession}
                  onRemoveSource={(sourceId) =>
                    mutateSource("/api/sources/remove", { sourceId }, "json")
                  }
                  onRenameSession={renameSession}
                  onReplaceResume={(formData) =>
                    mutateSource("/api/sources/replace-resume", formData)
                  }
                  onSelectSession={selectSession}
                  onSetActiveResume={async (sourceId) => {
                    const formData = new FormData();
                    formData.append("sourceId", sourceId);
                    await mutateSource("/api/sources/replace-resume", formData);
                  }}
                  onUpdateSource={updateSource}
                  pending={pending}
                  sessions={sessions}
                  sources={session?.sources ?? []}
                />
              }
              right={
                <ActionRail
                  activeResumeSourceId={session?.activeResumeSourceId}
                  artifacts={session?.artifacts ?? []}
                  jobSearchResults={
                    session?.savedJobSearchResults ?? session?.jobSearchResults ?? []
                  }
                  onRunAction={runAction}
                  onSaveJob={(jobId) => void saveJobResult(jobId)}
                  pending={pending}
                  pendingTrace={pendingTrace}
                  selectedOpportunitySourceId={session?.selectedOpportunitySourceId}
                  sources={session?.sources ?? []}
                  workflowTrace={session?.workflowTrace ?? []}
                />
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

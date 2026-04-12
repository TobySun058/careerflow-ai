"use client";

import { Download, Loader2, Play, Save } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type {
  DraftArtifact,
  JobSearchResult,
  SessionRecord
} from "@/lib/schemas";

import { AgentRail } from "@/components/agent-rail/agent-rail";
import { ThreePanelShell } from "@/components/layout/three-panel-shell";
import { SourcesPanel } from "@/components/sources/sources-panel";
import { Button } from "@/components/ui/button";
import { WorkspacePanel } from "@/components/workspace/workspace-panel";

export function WorkspaceShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") ?? "";

  const [session, setSession] = useState<SessionRecord | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [activeTab, setActiveTab] = useState("match");
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [followUpInput, setFollowUpInput] = useState("");
  const [jobSearchResults, setJobSearchResults] = useState<JobSearchResult[]>([]);
  const [error, setError] = useState("");

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

      const body = (await response.json()) as { session: SessionRecord };
      setSession(body.session);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load session.");
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

  const hasArtifacts = useMemo(() => Boolean(session?.artifacts.length), [session]);

  async function runWorkflow() {
    if (!sessionId) {
      return;
    }

    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/run-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });
      const body = (await response.json()) as
        | { session: SessionRecord }
        | { error: string };

      if (!response.ok || !("session" in body)) {
        throw new Error("error" in body ? body.error : "Unable to run workflow.");
      }

      setSession(body.session);
      await refreshSessions();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to run workflow.");
    } finally {
      setPending(false);
    }
  }

  async function sendFollowUp(instruction: string) {
    if (!sessionId || !instruction.trim()) {
      return;
    }

    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, instruction })
      });
      const body = (await response.json()) as
        | { session: SessionRecord }
        | { error: string };

      if (!response.ok || !("session" in body)) {
        throw new Error("error" in body ? body.error : "Follow-up failed.");
      }

      setSession(body.session);
      setFollowUpInput("");
      await refreshSessions();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Follow-up failed.");
    } finally {
      setPending(false);
    }
  }

  async function saveCurrentSession() {
    if (!session) {
      return;
    }

    setPending(true);
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
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, format: "markdown" })
      });
      if (!response.ok) {
        throw new Error("Export failed.");
      }

      const body = (await response.json()) as {
        filename: string;
        mimeType: string;
        content: string;
      };
      const blob = new Blob([body.content], { type: body.mimeType });
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

  async function searchJobs() {
    if (!session) {
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/job-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          query:
            session.jobProfile?.title ||
            session.jobProfile?.keywords.join(" ") ||
            "AI product engineering intern"
        })
      });
      const body = (await response.json()) as
        | { results: JobSearchResult[] }
        | { error: string };
      if (!response.ok || !("results" in body)) {
        throw new Error("error" in body ? body.error : "Search failed.");
      }
      setJobSearchResults(body.results);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Search failed.");
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

  function handleRegenerate(artifact: DraftArtifact) {
    const instructionMap: Record<string, string> = {
      match: "Refresh the fit analysis and recommended emphasis.",
      resume_rewrite: "Rewrite the resume bullets to be sharper and more tailored.",
      ats_resume: "Finalize ATS version.",
      outreach: "Rewrite the outreach to be more specific and polished.",
      linkedin_note: "Tighten the LinkedIn note.",
      cover_letter: "Refresh the cover letter snippet.",
      why_this_role: "Sharpen the why-this-role response.",
      interview_prep: "Generate stronger interview prep with harder questions.",
      plan: "Refresh the action plan."
    };

    void sendFollowUp(
      instructionMap[artifact.type] ?? `Regenerate ${artifact.title}.`
    );
  }

  return (
    <div className="min-h-screen px-4 py-4 lg:px-6 lg:py-5">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.6rem] border border-white/75 bg-white/70 p-4 shadow-panel backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-primary">
              CareerFlow AI
            </p>
            <h1 className="font-heading text-2xl font-semibold">
              Evidence-first career workflow
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => router.push("/")} variant="outline">
              New session
            </Button>
            <Button disabled={!sessionId || pending} onClick={runWorkflow}>
              {pending && !hasArtifacts ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Run workflow
            </Button>
            <Button
              disabled={!session || pending}
              onClick={saveCurrentSession}
              variant="outline"
            >
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

        {!sessionId ? (
          <div className="rounded-[2rem] border border-white/80 bg-white/75 p-10 text-center shadow-panel backdrop-blur">
            <p className="font-heading text-2xl font-semibold">Start from the intake page</p>
            <p className="mt-3 text-muted-foreground">
              Create a session with your resume and job description first, then the
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
          <ThreePanelShell
            center={
              <WorkspacePanel
                activeTab={activeTab}
                artifacts={session?.artifacts ?? []}
                onArtifactChange={updateArtifactContent}
                onRegenerate={handleRegenerate}
                onTabChange={setActiveTab}
              />
            }
            left={
              <SourcesPanel
                currentSessionId={session?.id}
                onSelectSession={(nextId) =>
                  router.push(`/workspace?sessionId=${nextId}`)
                }
                sessions={sessions}
                sources={session?.sourceManifest ?? []}
              />
            }
            right={
              <AgentRail
                followUpInput={followUpInput}
                jobSearchResults={jobSearchResults}
                onFollowUpInputChange={setFollowUpInput}
                onQuickAction={(instruction) => void sendFollowUp(instruction)}
                onSearchJobs={() => void searchJobs()}
                onSubmitFollowUp={() => void sendFollowUp(followUpInput)}
                pending={pending}
                workflowTrace={session?.workflowTrace ?? []}
              />
            }
          />
        )}
      </div>
    </div>
  );
}

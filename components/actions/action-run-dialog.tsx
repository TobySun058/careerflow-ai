"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";

import type { SourceDocument } from "@/lib/schemas";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type ActionRunConfig = {
  message?: string;
  selectedResumeSourceId?: string;
  selectedSourceId?: string;
  selectedSourceIds?: string[];
  filters?: {
    location?: string;
    remote?: boolean;
    employmentType?: string;
    limit?: number;
  };
};

function actionCopy(action: string) {
  switch (action) {
    case "parse_sources":
      return {
        title: "Parse Sources",
        description: "Choose which sources should be re-parsed into grounded resume and opportunity state.",
        placeholder: "Optional note, like: focus on the company page and my updated resume."
      };
    case "analyze_match":
      return {
        title: "Analyze Match",
        description: "Pick the resume and opportunity you want to compare.",
        placeholder: "Optional note, like: focus on product engineering and AI workflow alignment."
      };
    case "optimize_resume":
      return {
        title: "Optimize Resume",
        description: "Choose the resume and opportunity, then add any guidance for what the edit recommendations should focus on.",
        placeholder: "Example: tell me which bullets to change for Google SWE, and keep the current one-page structure."
      };
    case "draft_email":
      return {
        title: "Draft Email",
        description: "Choose the resume and opportunity, then say who this email is for or what tone you want.",
        placeholder: "Example: recruiter outreach, concise, warm, and specific to product engineering."
      };
    case "draft_connection_message":
      return {
        title: "Connection Message",
        description: "Choose the resume and opportunity, then add any target or tone guidance.",
        placeholder: "Example: short LinkedIn note to a hiring manager, curious and professional."
      };
    case "draft_cover_letter":
      return {
        title: "Cover Letter",
        description: "Choose the resume and opportunity, then add any company- or role-specific emphasis.",
        placeholder: "Example: one short cover letter focused on product thinking and AI systems."
      };
    case "search_jobs":
      return {
        title: "Search Jobs",
        description: "Choose the search direction you want the job agent to use.",
        placeholder: "Example: software engineering internships in AI startups or product engineering roles."
      };
    default:
      return {
        title: "Run Action",
        description: "Provide optional guidance before running this action.",
        placeholder: "Add a short note for the agent."
      };
  }
}

export function ActionRunDialog({
  action,
  open,
  pending,
  sources,
  activeResumeSourceId,
  selectedOpportunitySourceId,
  onClose,
  onSubmit
}: {
  action: string | null;
  open: boolean;
  pending: boolean;
  sources: SourceDocument[];
  activeResumeSourceId?: string | null;
  selectedOpportunitySourceId?: string | null;
  onClose: () => void;
  onSubmit: (config: ActionRunConfig) => Promise<void>;
}) {
  const resumeSources = useMemo(
    () => sources.filter((source) => source.type === "resume"),
    [sources]
  );
  const opportunitySources = useMemo(
    () => sources.filter((source) => source.kind === "opportunity"),
    [sources]
  );
  const copy = actionCopy(action ?? "");

  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [limit, setLimit] = useState("5");
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [selectedOpportunityId, setSelectedOpportunityId] = useState("");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setMessage("");
    setQuery("");
    setLocation("");
    setEmploymentType("");
    setRemoteOnly(false);
    setLimit("5");
    setSelectedResumeId(activeResumeSourceId ?? resumeSources[0]?.id ?? "");
    setSelectedOpportunityId(
      selectedOpportunitySourceId ?? opportunitySources[0]?.id ?? ""
    );
    setSelectedSourceIds(sources.map((source) => source.id));
  }, [
    activeResumeSourceId,
    open,
    opportunitySources,
    resumeSources,
    selectedOpportunitySourceId,
    sources
  ]);

  if (!open || !action) {
    return null;
  }

  const isSearch = action === "search_jobs";
  const isParse = action === "parse_sources";
  const needsResumeAndOpportunity = [
    "analyze_match",
    "optimize_resume",
    "draft_email",
    "draft_connection_message",
    "draft_cover_letter"
  ].includes(action);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <Card className="glass-panel max-h-[92vh] w-full max-w-3xl overflow-y-auto border-white/80 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-heading text-xl font-semibold">{copy.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
          </div>
          <Button onClick={onClose} size="icon" type="button" variant="outline">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-6 space-y-4">
          {isParse ? (
            <>
              <label className="block text-sm font-medium">
                Resume to parse
                <select
                  className="mt-2 flex h-11 w-full rounded-xl border border-border/70 bg-background/75 px-3 py-2 text-sm"
                  onChange={(event) => setSelectedResumeId(event.target.value)}
                  value={selectedResumeId}
                >
                  {resumeSources.length ? (
                    resumeSources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.title}
                      </option>
                    ))
                  ) : (
                    <option value="">No resume sources</option>
                  )}
                </select>
              </label>

              <div className="space-y-2">
                <p className="text-sm font-medium">Sources to include in parsing</p>
                <div className="grid gap-2 rounded-2xl border border-white/80 bg-white/55 p-4">
                  {sources.map((source) => {
                    const checked = selectedSourceIds.includes(source.id);
                    return (
                      <label
                        className="flex items-start gap-3 text-sm"
                        key={source.id}
                      >
                        <input
                          checked={checked}
                          className="mt-1"
                          onChange={(event) => {
                            setSelectedSourceIds((current) =>
                              event.target.checked
                                ? [...current, source.id]
                                : current.filter((candidate) => candidate !== source.id)
                            );
                          }}
                          type="checkbox"
                        />
                        <span>
                          {source.title}
                          <span className="block text-xs text-muted-foreground">
                            {source.type.replaceAll("_", " ")} · {source.kind}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}

          {needsResumeAndOpportunity ? (
            <>
              <label className="block text-sm font-medium">
                Resume
                <select
                  className="mt-2 flex h-11 w-full rounded-xl border border-border/70 bg-background/75 px-3 py-2 text-sm"
                  onChange={(event) => setSelectedResumeId(event.target.value)}
                  value={selectedResumeId}
                >
                  {resumeSources.length ? (
                    resumeSources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.title}
                      </option>
                    ))
                  ) : (
                    <option value="">No resume sources</option>
                  )}
                </select>
              </label>

              <label className="block text-sm font-medium">
                Opportunity
                <select
                  className="mt-2 flex h-11 w-full rounded-xl border border-border/70 bg-background/75 px-3 py-2 text-sm"
                  onChange={(event) => setSelectedOpportunityId(event.target.value)}
                  value={selectedOpportunityId}
                >
                  {opportunitySources.length ? (
                    opportunitySources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.title}
                      </option>
                    ))
                  ) : (
                    <option value="">No opportunity sources</option>
                  )}
                </select>
              </label>
            </>
          ) : null}

          {isSearch ? (
            <>
              <label className="block text-sm font-medium">
                Search direction
                <Input
                  className="mt-2"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={copy.placeholder}
                  value={query}
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium">
                  Location
                  <Input
                    className="mt-2"
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="NYC, Chicago, Remote..."
                    value={location}
                  />
                </label>
                <label className="block text-sm font-medium">
                  Employment type
                  <select
                    className="mt-2 flex h-11 w-full rounded-xl border border-border/70 bg-background/75 px-3 py-2 text-sm"
                    onChange={(event) => setEmploymentType(event.target.value)}
                    value={employmentType}
                  >
                    <option value="">Any</option>
                    <option value="internship">Internship</option>
                    <option value="full-time">Full-time</option>
                    <option value="contract">Contract</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/55 px-4 py-3 text-sm font-medium">
                  <input
                    checked={remoteOnly}
                    onChange={(event) => setRemoteOnly(event.target.checked)}
                    type="checkbox"
                  />
                  Remote only
                </label>
                <label className="block text-sm font-medium">
                  Result count
                  <select
                    className="mt-2 flex h-11 w-full rounded-xl border border-border/70 bg-background/75 px-3 py-2 text-sm"
                    onChange={(event) => setLimit(event.target.value)}
                    value={limit}
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="15">15</option>
                  </select>
                </label>
              </div>
            </>
          ) : (
            <label className="block text-sm font-medium">
              Agent note
              <Textarea
                className="mt-2 min-h-[160px]"
                onChange={(event) => setMessage(event.target.value)}
                placeholder={copy.placeholder}
                value={message}
              />
            </label>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            disabled={
              pending ||
              (isSearch ? !query.trim() : false) ||
              (needsResumeAndOpportunity && (!selectedResumeId || !selectedOpportunityId)) ||
              (isParse && !selectedSourceIds.length)
            }
            onClick={async () => {
              await onSubmit({
                message:
                  isSearch
                    ? query.trim()
                    : message.trim() || undefined,
                selectedResumeSourceId: selectedResumeId || undefined,
                selectedSourceId: selectedOpportunityId || undefined,
                selectedSourceIds: isParse ? selectedSourceIds : undefined,
                filters: isSearch
                  ? {
                      location: location.trim() || undefined,
                      remote: remoteOnly || undefined,
                      employmentType: employmentType || undefined,
                      limit: Number(limit) || undefined
                    }
                  : undefined
              });
              onClose();
            }}
            type="button"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Run Action
          </Button>
        </div>
      </Card>
    </div>
  );
}

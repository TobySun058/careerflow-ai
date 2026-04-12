"use client";

import { Loader2, MessageSquareQuote, Search, Sparkles } from "lucide-react";

import type { JobSearchResult, WorkflowTraceStep } from "@/lib/schemas";
import { formatTimestamp } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const QUICK_ACTIONS = [
  {
    label: "Analyze fit",
    instruction: "Re-run the fit analysis and sharpen strengths, gaps, and keywords."
  },
  {
    label: "Tailor resume",
    instruction: "Tailor the resume bullets more tightly to the role."
  },
  {
    label: "Draft outreach",
    instruction:
      "Rewrite the outreach and why-this-role draft to feel more specific and polished."
  },
  {
    label: "Generate interview prep",
    instruction: "Generate interview prep with harder behavioral and technical questions."
  },
  { label: "Build plan", instruction: "Build a tighter next-step action plan." },
  { label: "Finalize ATS version", instruction: "Finalize ATS version." }
] as const;

export function AgentRail({
  followUpInput,
  onFollowUpInputChange,
  onSubmitFollowUp,
  onQuickAction,
  onSearchJobs,
  workflowTrace,
  pending,
  jobSearchResults
}: {
  followUpInput: string;
  onFollowUpInputChange: (value: string) => void;
  onSubmitFollowUp: () => void;
  onQuickAction: (instruction: string) => void;
  onSearchJobs: () => void;
  workflowTrace: WorkflowTraceStep[];
  pending: boolean;
  jobSearchResults: JobSearchResult[];
}) {
  return (
    <div className="flex h-full flex-col gap-4">
      <Card className="glass-panel border-white/80 p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="font-heading text-base font-semibold">Agent Rail</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Chat with the supervisor, inspect the workflow trace, and launch targeted reruns.
        </p>
      </Card>

      <Card className="glass-panel border-white/80 p-4">
        <div className="mb-3 flex items-center gap-2">
          <MessageSquareQuote className="h-4 w-4 text-primary" />
          <h3 className="font-heading text-sm font-semibold">Follow-up</h3>
        </div>
        <div className="space-y-3">
          <Input
            onChange={(event) => onFollowUpInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSubmitFollowUp();
              }
            }}
            placeholder='Try: "make this more formal" or "focus on quant"'
            value={followUpInput}
          />
          <Button
            className="w-full"
            disabled={pending || !followUpInput.trim()}
            onClick={onSubmitFollowUp}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Send instruction
          </Button>
        </div>
      </Card>

      <Card className="glass-panel border-white/80 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-heading text-sm font-semibold">Quick actions</h3>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {QUICK_ACTIONS.map((action) => (
            <Button
              key={action.label}
              onClick={() => onQuickAction(action.instruction)}
              variant="outline"
            >
              {action.label}
            </Button>
          ))}
          <Button onClick={onSearchJobs} variant="secondary">
            <Search className="h-4 w-4" />
            Find matching jobs
          </Button>
        </div>
      </Card>

      <Card className="glass-panel flex-1 overflow-hidden border-white/80 p-4">
        <h3 className="font-heading text-sm font-semibold">Workflow trace</h3>
        <div className="mt-3 space-y-3 overflow-y-auto pr-1 scrollbar-thin">
          {workflowTrace.length ? (
            workflowTrace.map((step) => (
              <div className="rounded-2xl border border-white/80 bg-white/60 p-3" key={step.id}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{step.agent}</p>
                  <span className="text-xs text-muted-foreground">
                    {formatTimestamp(step.finishedAt ?? step.startedAt)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{step.summary}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Trace will populate after the supervisor runs.
            </p>
          )}
        </div>
      </Card>

      {jobSearchResults.length ? (
        <Card className="glass-panel border-white/80 p-4">
          <h3 className="font-heading text-sm font-semibold">Matching jobs</h3>
          <div className="mt-3 space-y-3">
            {jobSearchResults.map((job) => (
              <div className="rounded-2xl border border-white/80 bg-white/60 p-3" key={job.id}>
                <p className="text-sm font-medium">{job.title}</p>
                <p className="text-xs text-muted-foreground">
                  {job.company} · {job.location}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{job.summary}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

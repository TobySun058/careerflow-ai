import { Loader2 } from "lucide-react";

import type { WorkflowTraceStep } from "@/lib/schemas";
import { formatTimestamp } from "@/lib/utils";

import { Card } from "@/components/ui/card";

export function WorkflowTrace({
  steps,
  pendingStep
}: {
  steps: WorkflowTraceStep[];
  pendingStep?: {
    agent: string;
    summary: string;
    mcps: string[];
    tools: string[];
  } | null;
}) {
  return (
    <Card className="glass-panel border-white/80 p-4">
      <h3 className="font-heading text-sm font-semibold">Workflow Trace</h3>
      <div className="mt-3 space-y-3">
        {pendingStep ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{pendingStep.agent}</p>
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{pendingStep.summary}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              MCPs:{" "}
              {pendingStep.mcps.length
                ? pendingStep.mcps.join(", ")
                : "No external MCPs for this step"}
            </p>
            {pendingStep.tools.length ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Tools: {pendingStep.tools.join(", ")}
              </p>
            ) : null}
          </div>
        ) : null}
        {steps.length ? (
          steps.map((step) => (
            <div className="rounded-2xl border border-white/80 bg-white/60 p-3" key={step.id}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{step.agent}</p>
                <span className="text-xs text-muted-foreground">
                  {formatTimestamp(step.finishedAt ?? step.startedAt)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{step.summary}</p>
              {step.tools.length ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Tools: {step.tools.join(", ")}
                </p>
              ) : null}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            Agent routing will appear here after a chat turn or action run.
          </p>
        )}
      </div>
    </Card>
  );
}

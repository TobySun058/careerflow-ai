"use client";

import { useState } from "react";
import {
  FilePenLine,
  Mail,
  Search,
  Sparkles,
  Target,
  FileSignature,
  UserRoundPlus
} from "lucide-react";

import type {
  DraftArtifact,
  JobSearchResult,
  SourceDocument,
  WorkflowTraceStep
} from "@/lib/schemas";

import { ActionCard } from "@/components/actions/action-card";
import { ActionRunDialog, type ActionRunConfig } from "@/components/actions/action-run-dialog";
import { ArtifactSummary } from "@/components/actions/artifact-summary";
import { WorkflowTrace } from "@/components/actions/workflow-trace";
import { Card } from "@/components/ui/card";

const ACTIONS = [
  {
    id: "parse_sources",
    title: "Parse Sources",
    description: "Refresh the parsed resume and selected opportunity from current sources.",
    icon: <Sparkles className="h-4 w-4" />
  },
  {
    id: "analyze_match",
    title: "Analyze Match",
    description: "Score fit, identify gaps, and highlight priority keywords.",
    icon: <Target className="h-4 w-4" />
  },
  {
    id: "optimize_resume",
    title: "Optimize Resume",
    description: "Generate grounded section-by-section resume edit guidance for the selected role.",
    icon: <FilePenLine className="h-4 w-4" />
  },
  {
    id: "draft_email",
    title: "Draft Email",
    description: "Create a grounded outreach or recruiter email.",
    icon: <Mail className="h-4 w-4" />
  },
  {
    id: "draft_connection_message",
    title: "Connection Message",
    description: "Draft a short grounded LinkedIn connection note.",
    icon: <UserRoundPlus className="h-4 w-4" />
  },
  {
    id: "draft_cover_letter",
    title: "Cover Letter",
    description: "Draft a grounded cover letter for the selected opportunity.",
    icon: <FileSignature className="h-4 w-4" />
  },
  {
    id: "search_jobs",
    title: "Search Jobs",
    description: "Find adjacent roles using the current session context.",
    icon: <Search className="h-4 w-4" />
  }
] as const;

export function ActionRail({
  onRunAction,
  workflowTrace,
  artifacts,
  sources,
  activeResumeSourceId,
  selectedOpportunitySourceId,
  jobSearchResults,
  onSaveJob,
  pending,
  pendingTrace
}: {
  onRunAction: (action: string, config: ActionRunConfig) => Promise<void>;
  workflowTrace: WorkflowTraceStep[];
  artifacts: DraftArtifact[];
  sources: SourceDocument[];
  activeResumeSourceId?: string | null;
  selectedOpportunitySourceId?: string | null;
  jobSearchResults: JobSearchResult[];
  onSaveJob: (jobId: string) => void;
  pending: boolean;
  pendingTrace?: {
    agent: string;
    summary: string;
    mcps: string[];
    tools: string[];
  } | null;
}) {
  const [activeActionId, setActiveActionId] = useState<string | null>(null);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <Card className="glass-panel border-white/80 p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="font-heading text-base font-semibold">Actions</h2>
        </div>
      </Card>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 scrollbar-thin">
        <div className="space-y-3">
          {ACTIONS.map((action) => (
            <ActionCard
              description={action.description}
              disabled={pending}
              icon={action.icon}
              key={action.id}
              onClick={() => setActiveActionId(action.id)}
              title={action.title}
            />
          ))}
        </div>

        <WorkflowTrace pendingStep={pendingTrace} steps={workflowTrace} />
        <ArtifactSummary
          artifacts={artifacts}
          jobSearchResults={jobSearchResults}
          onSaveJob={onSaveJob}
          pending={pending}
        />
      </div>

      <ActionRunDialog
        action={activeActionId}
        activeResumeSourceId={activeResumeSourceId}
        onClose={() => setActiveActionId(null)}
        onSubmit={(config) => onRunAction(activeActionId ?? "", config)}
        open={Boolean(activeActionId)}
        pending={pending}
        selectedOpportunitySourceId={selectedOpportunitySourceId}
        sources={sources}
      />
    </div>
  );
}

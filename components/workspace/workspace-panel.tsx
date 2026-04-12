"use client";

import type { DraftArtifact } from "@/lib/schemas";

import { ArtifactCard } from "@/components/cards/artifact-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";

const TAB_LABELS = [
  { value: "match", label: "Match" },
  { value: "resume", label: "Resume Rewrite" },
  { value: "outreach", label: "Outreach" },
  { value: "interview", label: "Interview Prep" },
  { value: "plan", label: "Plan" }
] as const;

function tabFilter(tab: string, artifact: DraftArtifact) {
  switch (tab) {
    case "match":
      return artifact.type === "match" || artifact.type === "job_search";
    case "resume":
      return artifact.type === "resume_rewrite" || artifact.type === "ats_resume";
    case "outreach":
      return ["outreach", "linkedin_note", "cover_letter", "why_this_role"].includes(
        artifact.type
      );
    case "interview":
      return artifact.type === "interview_prep";
    case "plan":
      return artifact.type === "plan";
    default:
      return false;
  }
}

export function WorkspacePanel({
  activeTab,
  artifacts,
  onTabChange,
  onArtifactChange,
  onRegenerate
}: {
  activeTab: string;
  artifacts: DraftArtifact[];
  onTabChange: (tab: string) => void;
  onArtifactChange: (artifactId: string, nextContent: string) => void;
  onRegenerate: (artifact: DraftArtifact) => void;
}) {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.6rem] border border-white/75 bg-white/70 p-5 shadow-panel backdrop-blur">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Notebook-style workspace</Badge>
            <Badge variant="success">Evidence-first</Badge>
          </div>
          <h2 className="mt-3 font-heading text-2xl font-semibold">
            Workspace
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each artifact stays editable and grounded back to source chunks.
          </p>
        </div>
      </div>

      <Tabs
        className="flex min-h-0 flex-1 flex-col"
        onValueChange={onTabChange}
        value={activeTab}
      >
        <TabsList className="grid grid-cols-2 gap-1.5 lg:grid-cols-5">
          {TAB_LABELS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TAB_LABELS.map((tab) => {
          const tabArtifacts = artifacts.filter((artifact) => tabFilter(tab.value, artifact));
          return (
            <TabsContent
              className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin"
              key={tab.value}
              value={tab.value}
            >
              {tabArtifacts.length ? (
                <div className="space-y-4">
                  {tabArtifacts.map((artifact) => (
                    <ArtifactCard
                      artifact={artifact}
                      key={artifact.id}
                      onChange={onArtifactChange}
                      onRegenerate={onRegenerate}
                    />
                  ))}
                </div>
              ) : (
                <Card className="glass-panel border-dashed border-white/80 p-8 text-center">
                  <p className="font-medium">No output in this tab yet</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Run the workflow or use a quick action from the right rail.
                  </p>
                </Card>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

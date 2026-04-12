import { BookmarkPlus, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DraftArtifact, JobSearchResult } from "@/lib/schemas";

import { Card } from "@/components/ui/card";

export function ArtifactSummary({
  artifacts,
  jobSearchResults,
  onSaveJob,
  pending
}: {
  artifacts: DraftArtifact[];
  jobSearchResults: JobSearchResult[];
  onSaveJob: (jobId: string) => void;
  pending: boolean;
}) {
  return (
    <Card className="glass-panel border-white/80 p-4">
      <h3 className="font-heading text-sm font-semibold">Latest Outputs</h3>
      <div className="mt-3 space-y-3">
        {artifacts.slice(0, 5).map((artifact) => (
          <div className="rounded-2xl border border-white/80 bg-white/60 p-3" key={artifact.id}>
            <p className="text-sm font-medium">{artifact.title}</p>
            <p className="mt-1 text-xs capitalize text-muted-foreground">
              {artifact.type.replaceAll("_", " ")}
            </p>
            <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
              {artifact.content}
            </p>
          </div>
        ))}
        {!artifacts.length && !jobSearchResults.length ? (
          <p className="text-sm text-muted-foreground">
            Generated artifacts and job search snapshots will accumulate here.
          </p>
        ) : null}
        {jobSearchResults.length ? (
          <div className="space-y-2">
            <div className="rounded-2xl border border-white/80 bg-white/60 p-3">
              <p className="text-sm font-medium">Job Search Snapshot</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {jobSearchResults.length} matching roles are currently loaded.
              </p>
            </div>
            {jobSearchResults.slice(0, 5).map((job) => (
              <div className="rounded-2xl border border-white/80 bg-white/60 p-3" key={job.id}>
                <p className="text-sm font-medium">{job.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {job.company} {job.location ? `- ${job.location}` : ""}
                </p>
                <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                  {job.summary}
                </p>
                <Button
                  className="mt-3 w-full"
                  disabled={pending || Boolean(job.savedSourceId)}
                  onClick={() => onSaveJob(job.id)}
                  size="sm"
                  variant="outline"
                >
                  {job.savedSourceId ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Saved
                    </>
                  ) : (
                    <>
                      <BookmarkPlus className="h-4 w-4" />
                      Save to Sources
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

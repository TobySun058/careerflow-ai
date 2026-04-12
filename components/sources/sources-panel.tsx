"use client";

import { Database, FileText, FolderClock, Link2 } from "lucide-react";

import type { SessionRecord, SourceDocument } from "@/lib/schemas";
import { formatTimestamp } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function SourceItem({ source }: { source: SourceDocument }) {
  const icon =
    source.subtype === "job_url" || source.subtype === "company_page" ? (
      <Link2 className="h-4 w-4 text-primary" />
    ) : (
      <FileText className="h-4 w-4 text-primary" />
    );

  return (
    <Card className="glass-panel border-white/80 p-4 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-primary/10 p-2">{icon}</div>
          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium text-foreground">{source.title}</p>
              <p className="text-xs text-muted-foreground">{source.subtype}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={source.kind === "truth" ? "success" : "outline"}>
                {source.kind}
              </Badge>
              <Badge variant="outline">
                {source.metadata.chunkCount ?? source.chunkIds.length} chunks
              </Badge>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 line-clamp-4 text-sm text-muted-foreground">
        {source.preview}
      </p>
    </Card>
  );
}

export function SourcesPanel({
  sources,
  sessions,
  currentSessionId,
  onSelectSession
}: {
  sources: SourceDocument[];
  sessions: SessionRecord[];
  currentSessionId?: string;
  onSelectSession: (sessionId: string) => void;
}) {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="rounded-[1.6rem] border border-white/75 bg-white/70 p-5 shadow-panel backdrop-blur">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <h2 className="font-heading text-base font-semibold">Sources</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Truth store and opportunity store stay separated to keep claims honest.
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin">
        {sources.length ? (
          sources.map((source) => <SourceItem key={source.id} source={source} />)
        ) : (
          <Card className="glass-panel border-dashed border-white/80 p-5">
            <p className="text-sm text-muted-foreground">
              Upload a resume or paste a job description to populate the source rail.
            </p>
          </Card>
        )}
      </div>

      <div className="rounded-[1.5rem] border border-white/75 bg-white/65 p-4 shadow-soft">
        <div className="mb-3 flex items-center gap-2">
          <FolderClock className="h-4 w-4 text-primary" />
          <h3 className="font-heading text-sm font-semibold">Saved sessions</h3>
        </div>
        <div className="space-y-2">
          {sessions.slice(0, 5).map((session) => (
            <Button
              className="h-auto w-full justify-start rounded-2xl py-3 text-left"
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              variant={session.id === currentSessionId ? "secondary" : "ghost"}
            >
              <div>
                <div className="text-sm font-medium">
                  {session.jobProfile?.title ?? "Draft session"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatTimestamp(session.updatedAt)}
                </div>
              </div>
            </Button>
          ))}
          {!sessions.length && (
            <p className="text-xs text-muted-foreground">
              No saved sessions yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

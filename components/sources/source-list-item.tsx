"use client";

import { Eye, FileText, Link2, Star, Trash2 } from "lucide-react";

import type { SourceDocument } from "@/lib/schemas";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function SourceListItem({
  source,
  onOpen,
  onRemove,
  onSetActiveResume
}: {
  source: SourceDocument;
  onOpen: (source: SourceDocument) => void;
  onRemove: (sourceId: string) => void;
  onSetActiveResume: (sourceId: string) => void;
}) {
  const icon =
    source.type === "url" || source.type === "job_url" || source.type === "company_page" ? (
      <Link2 className="h-4 w-4 text-primary" />
    ) : (
      <FileText className="h-4 w-4 text-primary" />
    );

  return (
    <Card className="glass-panel border-white/80 p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2">{icon}</div>
          <div>
            <p className="text-sm font-medium">{source.title}</p>
            <p className="mt-1 text-xs capitalize text-muted-foreground">
              {source.type.replaceAll("_", " ")} - {source.kind} source
            </p>
            {source.type === "resume" && source.active ? (
              <p className="mt-2 text-xs font-medium text-primary">Active resume</p>
            ) : null}
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => onOpen(source)} size="icon" variant="outline">
            <Eye className="h-4 w-4" />
          </Button>
          {source.type === "resume" && !source.active ? (
            <Button onClick={() => onSetActiveResume(source.id)} size="icon" variant="outline">
              <Star className="h-4 w-4" />
            </Button>
          ) : null}
          <Button onClick={() => onRemove(source.id)} size="icon" variant="outline">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

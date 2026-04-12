"use client";

import { Copy } from "lucide-react";
import { useEffect, useState } from "react";

import type { DraftArtifact } from "@/lib/schemas";

import { EvidenceChips } from "@/components/shared/evidence-chips";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export function ResponseBlock({
  artifact,
  onArtifactChange
}: {
  artifact: DraftArtifact;
  onArtifactChange: (artifactId: string, nextContent: string) => void;
}) {
  const [value, setValue] = useState(artifact.content);

  useEffect(() => {
    setValue(artifact.content);
  }, [artifact.content]);

  return (
    <Card className="glass-panel border-white/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{artifact.title}</p>
          <div className="mt-2">
            <EvidenceChips refs={artifact.sourceRefs} />
          </div>
        </div>
        <Button
          onClick={() => navigator.clipboard.writeText(value)}
          size="sm"
          type="button"
          variant="outline"
        >
          <Copy className="h-4 w-4" />
          Copy
        </Button>
      </div>
      <Textarea
        className="mt-3 min-h-[160px] bg-white/70"
        onBlur={() => onArtifactChange(artifact.id, value)}
        onChange={(event) => setValue(event.target.value)}
        value={value}
      />
    </Card>
  );
}

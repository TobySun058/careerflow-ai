"use client";

import { Copy, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import type { DraftArtifact } from "@/lib/schemas";

import { SourceChips } from "@/components/shared/source-chips";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export function ArtifactCard({
  artifact,
  onChange,
  onRegenerate
}: {
  artifact: DraftArtifact;
  onChange: (artifactId: string, nextContent: string) => void;
  onRegenerate: (artifact: DraftArtifact) => void;
}) {
  const [localValue, setLocalValue] = useState(artifact.content);

  useEffect(() => {
    setLocalValue(artifact.content);
  }, [artifact.content]);

  return (
    <Card className="glass-panel border-white/80">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <CardTitle>{artifact.title}</CardTitle>
            <SourceChips refs={artifact.sourceRefs} />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => navigator.clipboard.writeText(localValue)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Copy className="h-4 w-4" />
              Copy
            </Button>
            <Button
              onClick={() => onRegenerate(artifact)}
              size="sm"
              type="button"
              variant="outline"
            >
              <RotateCcw className="h-4 w-4" />
              Regenerate
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          className="min-h-[220px] bg-white/70"
          onBlur={() => onChange(artifact.id, localValue)}
          onChange={(event) => setLocalValue(event.target.value)}
          value={localValue}
        />
        <p className="text-xs text-muted-foreground">
          Claim checker attached {artifact.claimMap.length} supporting claim
          references.
        </p>
      </CardContent>
    </Card>
  );
}

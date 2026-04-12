import type { EvidenceRef } from "@/lib/schemas";

import { Badge } from "@/components/ui/badge";

export function SourceChips({ refs }: { refs: EvidenceRef[] }) {
  const visibleRefs = refs.slice(0, 4);

  if (!visibleRefs.length) {
    return (
      <Badge className="text-[11px]" variant="outline">
        No source links yet
      </Badge>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {visibleRefs.map((ref) => (
        <Badge
          className="max-w-full truncate text-[11px]"
          key={`${ref.sourceId}-${ref.chunkId}`}
          variant={ref.kind === "truth" ? "success" : "outline"}
        >
          {ref.kind === "truth" ? "Truth" : "Opportunity"} · {ref.title}
        </Badge>
      ))}
    </div>
  );
}

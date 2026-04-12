import type { EvidenceRef } from "@/lib/schemas";

import { Badge } from "@/components/ui/badge";

export function EvidenceChips({ refs }: { refs: EvidenceRef[] }) {
  const visibleRefs = refs.slice(0, 2);

  if (!visibleRefs.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {visibleRefs.map((ref) => (
        <Badge
          className="max-w-full truncate text-[11px]"
          key={`${ref.sourceId}-${ref.chunkId}`}
          variant="outline"
        >
          {ref.title}
        </Badge>
      ))}
    </div>
  );
}

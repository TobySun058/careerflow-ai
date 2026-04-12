import type { SourceDocument } from "@/lib/schemas";

export function SourcePreview({ source }: { source: SourceDocument }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/55 p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        Preview
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
        {source.preview}
      </p>
      {source.metadata.url ? (
        <p className="mt-2 break-all text-xs text-primary">{source.metadata.url}</p>
      ) : null}
    </div>
  );
}

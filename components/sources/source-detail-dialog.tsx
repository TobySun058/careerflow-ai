"use client";

import { Download, ExternalLink, Save, X } from "lucide-react";
import { useEffect, useState } from "react";

import type { SourceDocument } from "@/lib/schemas";
import { slugify } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export function SourceDetailDialog({
  open,
  source,
  pending,
  onClose,
  onSave
}: {
  open: boolean;
  source: SourceDocument | null;
  pending: boolean;
  onClose: () => void;
  onSave: (input: { sourceId: string; title: string; content: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (source) {
      setTitle(source.title);
      setContent(source.content);
    }
  }, [source]);

  const currentSource = source;

  if (!open || !currentSource) {
    return null;
  }

  const sourceId = currentSource.id;
  const sourceTitle = currentSource.title;
  const sourceType = currentSource.type;
  const sourceKind = currentSource.kind;
  const sourceUrl = currentSource.metadata.url;
  const dirty = title.trim() !== currentSource.title || content !== currentSource.content;

  function downloadSource() {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(title || sourceTitle || "source") || "source"}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <Card className="glass-panel flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden border-white/80 p-0">
        <div className="flex items-start justify-between gap-4 border-b border-white/70 px-6 py-5">
          <div className="min-w-0">
            <h3 className="truncate font-heading text-xl font-semibold">{sourceTitle}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {sourceType.replaceAll("_", " ")} · {sourceKind} source
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {sourceUrl ? (
              <Button
                onClick={() => window.open(sourceUrl, "_blank", "noopener,noreferrer")}
                size="icon"
                type="button"
                variant="outline"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            ) : null}
            <Button onClick={downloadSource} type="button" variant="outline">
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button onClick={onClose} size="icon" type="button" variant="outline">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden px-6 py-5">
          <Tabs className="flex h-full min-h-0 flex-col" defaultValue="preview">
            <TabsList className="w-fit">
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="edit">Edit</TabsTrigger>
            </TabsList>

            <TabsContent className="mt-4 min-h-0 flex-1 overflow-hidden" value="preview">
              <div className="h-full overflow-y-auto rounded-2xl border border-white/80 bg-white/60 p-4 text-sm leading-7 whitespace-pre-wrap scrollbar-thin">
                {content || "This source is empty."}
              </div>
            </TabsContent>

            <TabsContent className="mt-4 min-h-0 flex-1 overflow-hidden" value="edit">
              <div className="flex h-full min-h-0 flex-col gap-4">
                <label className="block text-sm font-medium">
                  Title
                  <Input
                    className="mt-2"
                    onChange={(event) => setTitle(event.target.value)}
                    value={title}
                  />
                </label>

                <label className="block min-h-0 flex-1 text-sm font-medium">
                  Content
                  <Textarea
                    className="mt-2 min-h-[360px] h-full resize-none bg-white/80"
                    onChange={(event) => setContent(event.target.value)}
                    value={content}
                  />
                </label>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex justify-end gap-3 border-t border-white/70 px-6 py-4">
          <Button onClick={onClose} type="button" variant="outline">
            Close
          </Button>
          <Button
            disabled={pending || !dirty || !title.trim() || !content.trim()}
            onClick={async () => {
              await onSave({
                sourceId,
                title: title.trim(),
                content: content.trim()
              });
              onClose();
            }}
            type="button"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </Card>
    </div>
  );
}

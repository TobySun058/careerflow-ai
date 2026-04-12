"use client";

import { Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type AddSourceMode = "add" | "replace-resume";

export function AddSourceDialog({
  mode,
  open,
  pending,
  onClose,
  onSubmit
}: {
  mode: AddSourceMode;
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  const [sourceType, setSourceType] = useState("uploaded_document");
  const [corpusType, setCorpusType] = useState("truth");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) {
      setSourceType(mode === "replace-resume" ? "resume" : "uploaded_document");
      setCorpusType(mode === "replace-resume" ? "truth" : "truth");
      setTitle("");
      setText("");
      setUrl("");
      setFile(null);
    }
  }, [mode, open]);

  if (!open) {
    return null;
  }

  const isResumeMode = mode === "replace-resume";
  const canSubmit = Boolean(file || text.trim() || url.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
      <Card className="glass-panel max-h-[90vh] w-full max-w-2xl overflow-y-auto border-white/80 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-heading text-xl font-semibold">
              {isResumeMode ? "Replace Resume" : "Add Source"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {isResumeMode
                ? "Upload or paste the new active resume."
                : "Add a document, pasted text, note, or URL into the current session."}
            </p>
          </div>
          <Button onClick={onClose} size="icon" type="button" variant="outline">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-6 space-y-4">
          {!isResumeMode ? (
            <label className="block text-sm font-medium">
              Source type
              <select
                className="mt-2 flex h-11 w-full rounded-xl border border-border/70 bg-background/75 px-3 py-2 text-sm"
                onChange={(event) => setSourceType(event.target.value)}
                value={sourceType}
              >
                <option value="uploaded_document">Uploaded Document</option>
                <option value="pasted_text">Pasted Text</option>
                <option value="notes">Notes</option>
                <option value="resume">Resume</option>
                <option value="job_description">Job Description</option>
                <option value="url">URL</option>
              </select>
            </label>
          ) : null}

          {!isResumeMode ? (
            <label className="block text-sm font-medium">
              Corpus
              <select
                className="mt-2 flex h-11 w-full rounded-xl border border-border/70 bg-background/75 px-3 py-2 text-sm"
                onChange={(event) => setCorpusType(event.target.value)}
                value={corpusType}
              >
                <option value="truth">Truth</option>
                <option value="opportunity">Opportunity</option>
              </select>
            </label>
          ) : null}

          <label className="block text-sm font-medium">
            Title
            <Input
              className="mt-2"
              onChange={(event) => setTitle(event.target.value)}
              placeholder={isResumeMode ? "My updated resume" : "Optional source title"}
              value={title}
            />
          </label>

          <label className="block text-sm font-medium">
            Upload file
            <Input
              className="mt-2"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>

          <label className="block text-sm font-medium">
            Paste text
            <Textarea
              className="mt-2 min-h-[160px]"
              onChange={(event) => setText(event.target.value)}
              placeholder="Paste source text here..."
              value={text}
            />
          </label>

          {!isResumeMode ? (
            <label className="block text-sm font-medium">
              URL
              <Input
                className="mt-2"
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/source"
                value={url}
              />
            </label>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            disabled={pending || !canSubmit}
            onClick={async () => {
              const formData = new FormData();
              formData.append("sourceType", isResumeMode ? "resume" : sourceType);
              formData.append("corpusType", isResumeMode ? "truth" : corpusType);
              formData.append("title", title);
              formData.append("text", text);
              formData.append("url", url);
              if (file) {
                formData.append("file", file);
              }
              await onSubmit(formData);
            }}
            type="button"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isResumeMode ? "Replace resume" : "Add source"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

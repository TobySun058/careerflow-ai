"use client";

import {
  Check,
  Database,
  FolderClock,
  FolderOpen,
  PencilLine,
  Plus,
  RefreshCcw,
  Trash2,
  X
} from "lucide-react";
import { useState } from "react";

import type { SessionRecord, SourceDocument } from "@/lib/schemas";
import { formatTimestamp } from "@/lib/utils";

import { AddSourceDialog } from "@/components/sources/add-source-dialog";
import { SourceDetailDialog } from "@/components/sources/source-detail-dialog";
import { SourceListItem } from "@/components/sources/source-list-item";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function SourcesPanel({
  sources,
  sessions,
  currentSessionId,
  pending,
  onSelectSession,
  onAddSource,
  onReplaceResume,
  onRemoveSource,
  onUpdateSource,
  onSetActiveResume,
  onRenameSession,
  onDeleteSession
}: {
  sources: SourceDocument[];
  sessions: SessionRecord[];
  currentSessionId?: string;
  pending: boolean;
  onSelectSession: (sessionId: string) => Promise<void>;
  onAddSource: (formData: FormData) => Promise<void>;
  onReplaceResume: (formData: FormData) => Promise<void>;
  onRemoveSource: (sourceId: string) => Promise<void>;
  onUpdateSource: (input: {
    sourceId: string;
    title: string;
    content: string;
  }) => Promise<void>;
  onSetActiveResume: (sourceId: string) => Promise<void>;
  onRenameSession: (sessionId: string, title: string) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
}) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isReplaceResumeOpen, setIsReplaceResumeOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [selectedSource, setSelectedSource] = useState<SourceDocument | null>(null);

  function beginRename(session: SessionRecord) {
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  }

  function cancelRename() {
    setEditingSessionId(null);
    setEditingTitle("");
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <Card className="glass-panel border-white/80 p-5">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <h2 className="font-heading text-base font-semibold">Sources</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Truth and opportunity sources stay visible while you chat.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={pending} onClick={() => setIsAddOpen(true)} variant="outline">
            <Plus className="h-4 w-4" />
            Add Source
          </Button>
          <Button
            disabled={pending}
            onClick={() => setIsReplaceResumeOpen(true)}
            variant="outline"
          >
            <RefreshCcw className="h-4 w-4" />
            Replace Resume
          </Button>
        </div>
      </Card>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin">
        {sources.length ? (
          sources.map((source) => (
            <SourceListItem
              key={source.id}
              onOpen={setSelectedSource}
              onRemove={(sourceId) => void onRemoveSource(sourceId)}
              onSetActiveResume={(sourceId) => void onSetActiveResume(sourceId)}
              source={source}
            />
          ))
        ) : (
          <Card className="glass-panel border-dashed border-white/80 p-5">
            <p className="text-sm text-muted-foreground">
              No session sources yet. Add a resume, job description, note, or URL.
            </p>
          </Card>
        )}
      </div>

      <Card className="glass-panel border-white/80 p-4">
        <div className="mb-3 flex items-center gap-2">
          <FolderClock className="h-4 w-4 text-primary" />
          <h3 className="font-heading text-sm font-semibold">Saved Sessions</h3>
        </div>
        <div className="space-y-2">
          {sessions.slice(0, 8).map((session) => {
            const isEditing = editingSessionId === session.id;
            return (
              <Card
                className={`border p-3 shadow-none ${
                  session.id === currentSessionId
                    ? "border-primary/40 bg-primary/5"
                    : "border-white/70 bg-white/55"
                }`}
                key={session.id}
              >
                <div className="space-y-3">
                  {isEditing ? (
                    <Input
                      autoFocus
                      onChange={(event) => setEditingTitle(event.target.value)}
                      value={editingTitle}
                    />
                  ) : (
                    <div className="text-sm font-medium">{session.title}</div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {formatTimestamp(session.updatedAt)}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isEditing ? (
                      <>
                        <Button
                          disabled={pending || !editingTitle.trim()}
                          onClick={async () => {
                            await onRenameSession(session.id, editingTitle);
                            cancelRename();
                          }}
                          size="sm"
                          variant="secondary"
                        >
                          <Check className="h-4 w-4" />
                          Save
                        </Button>
                        <Button
                          disabled={pending}
                          onClick={cancelRename}
                          size="sm"
                          variant="ghost"
                        >
                          <X className="h-4 w-4" />
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          disabled={pending || session.id === currentSessionId}
                          onClick={() => void onSelectSession(session.id)}
                          size="sm"
                          variant={session.id === currentSessionId ? "secondary" : "outline"}
                        >
                          <FolderOpen className="h-4 w-4" />
                          {session.id === currentSessionId ? "Open" : "Open Session"}
                        </Button>
                        <Button
                          disabled={pending}
                          onClick={() => beginRename(session)}
                          size="sm"
                          variant="ghost"
                        >
                          <PencilLine className="h-4 w-4" />
                          Rename
                        </Button>
                        <Button
                          disabled={pending}
                          onClick={() => void onDeleteSession(session.id)}
                          size="sm"
                          variant="ghost"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </Card>

      <AddSourceDialog
        mode="add"
        onClose={() => setIsAddOpen(false)}
        onSubmit={async (formData) => {
          await onAddSource(formData);
          setIsAddOpen(false);
        }}
        open={isAddOpen}
        pending={pending}
      />
      <AddSourceDialog
        mode="replace-resume"
        onClose={() => setIsReplaceResumeOpen(false)}
        onSubmit={async (formData) => {
          await onReplaceResume(formData);
          setIsReplaceResumeOpen(false);
        }}
        open={isReplaceResumeOpen}
        pending={pending}
      />
      <SourceDetailDialog
        onClose={() => setSelectedSource(null)}
        onSave={(input) => onUpdateSource(input)}
        open={Boolean(selectedSource)}
        pending={pending}
        source={selectedSource}
      />
    </div>
  );
}

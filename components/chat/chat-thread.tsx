"use client";

import { useEffect, useRef } from "react";

import type { ChatMessage as ChatMessageModel, DraftArtifact } from "@/lib/schemas";

import { ChatMessage } from "@/components/chat/chat-message";
import { Card } from "@/components/ui/card";

export function ChatThread({
  messages,
  artifacts,
  pending,
  pendingTrace,
  onArtifactChange
}: {
  messages: ChatMessageModel[];
  artifacts: DraftArtifact[];
  pending: boolean;
  pendingTrace?: {
    agent: string;
    summary: string;
    mcps: string[];
    tools: string[];
  } | null;
  onArtifactChange: (artifactId: string, nextContent: string) => void;
}) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  if (!messages.length) {
    return (
      <Card className="glass-panel border-dashed border-white/80 p-8 text-center">
        <p className="font-medium">Ask the workspace anything</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Try "How well do I match this role?" or "Find software engineering internships in NYC."
        </p>
      </Card>
    );
  }

  if (false && !messages.length) {
    return (
      <Card className="glass-panel border-dashed border-white/80 p-8 text-center">
        <p className="font-medium">Ask the workspace anything</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Try “How well do I match this internship?” or “Rewrite my resume for this role.”
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <ChatMessage
          artifacts={artifacts}
          key={message.id}
          message={message}
          onArtifactChange={onArtifactChange}
        />
      ))}
      {pending ? (
        <Card className="glass-panel w-full max-w-xl border-white/80 p-4">
          <p className="text-sm font-medium">
            {pendingTrace?.agent ?? "OrchestratorAgent"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {pendingTrace?.summary ??
              "Routing your request and grounding the response."}
          </p>
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            <p>
              MCPs:{" "}
              {pendingTrace?.mcps.length
                ? pendingTrace.mcps.join(", ")
                : "No external MCPs for this step"}
            </p>
            {pendingTrace?.tools.length ? (
              <p>Tools: {pendingTrace.tools.join(", ")}</p>
            ) : null}
          </div>
        </Card>
      ) : null}
      <div ref={bottomRef} />
    </div>
  );
}

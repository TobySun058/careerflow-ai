import type { ChatMessage, DraftArtifact } from "@/lib/schemas";

import { ChatInput } from "@/components/chat/chat-input";
import { ChatThread } from "@/components/chat/chat-thread";
import { Card } from "@/components/ui/card";

export function ChatWorkspace({
  messages,
  artifacts,
  pending,
  pendingTrace,
  onSendMessage,
  onArtifactChange
}: {
  messages: ChatMessage[];
  artifacts: DraftArtifact[];
  pending: boolean;
  pendingTrace?: {
    agent: string;
    summary: string;
    mcps: string[];
    tools: string[];
  } | null;
  onSendMessage: (message: string) => Promise<void>;
  onArtifactChange: (artifactId: string, nextContent: string) => void;
}) {
  return (
    <Card className="glass-panel flex h-full min-h-0 flex-col overflow-hidden border-white/80">
      <div className="border-b border-white/70 px-5 py-4">
        <h2 className="font-heading text-2xl font-semibold">Conversation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask naturally. The orchestrator will route each request to parse, search, match, or email agents.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 scrollbar-thin">
        <ChatThread
          artifacts={artifacts}
          messages={messages}
          onArtifactChange={onArtifactChange}
          pending={pending}
          pendingTrace={pendingTrace}
        />
      </div>

      <ChatInput onSend={onSendMessage} pending={pending} />
    </Card>
  );
}

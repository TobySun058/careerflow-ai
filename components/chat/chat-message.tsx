import type { DraftArtifact, ChatMessage as ChatMessageModel } from "@/lib/schemas";

import { ResponseBlock } from "@/components/chat/response-block";
import { EvidenceChips } from "@/components/shared/evidence-chips";
import { Card } from "@/components/ui/card";

export function ChatMessage({
  message,
  artifacts,
  onArtifactChange
}: {
  message: ChatMessageModel;
  artifacts: DraftArtifact[];
  onArtifactChange: (artifactId: string, nextContent: string) => void;
}) {
  const isUser = message.role === "user";
  const attachedArtifacts = artifacts.filter((artifact) =>
    message.artifactIds.includes(artifact.id)
  );

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`w-full max-w-4xl ${isUser ? "items-end" : "items-start"}`}>
        <Card
          className={`border-white/80 p-4 ${
            isUser
              ? "bg-primary text-primary-foreground shadow-soft"
              : "glass-panel"
          }`}
        >
          <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
          {!isUser && message.sourceRefs.length ? (
            <div className="mt-3">
              <EvidenceChips refs={message.sourceRefs} />
            </div>
          ) : null}
        </Card>

        {attachedArtifacts.length ? (
          <div className="mt-3 space-y-3">
            {attachedArtifacts.map((artifact) => (
              <ResponseBlock
                artifact={artifact}
                key={artifact.id}
                onArtifactChange={onArtifactChange}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

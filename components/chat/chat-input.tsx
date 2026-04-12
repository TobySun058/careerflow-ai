"use client";

import { SendHorizonal } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ChatInput({
  pending,
  onSend
}: {
  pending: boolean;
  onSend: (message: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");

  return (
    <div className="border-t border-white/70 bg-white/65 px-5 py-4 backdrop-blur">
      <Textarea
        className="min-h-[92px] bg-white/80"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (!pending && value.trim()) {
              const message = value.trim();
              setValue("");
              void onSend(message).catch(() => setValue(message));
            }
          }
        }}
        placeholder='Ask anything, like "What are my biggest gaps?" or "Draft a networking message."'
        value={value}
      />
      <div className="mt-3 flex justify-end">
        <Button
          disabled={pending || !value.trim()}
          onClick={() => {
            if (value.trim()) {
              const message = value.trim();
              setValue("");
              void onSend(message).catch(() => setValue(message));
            }
          }}
        >
          <SendHorizonal className="h-4 w-4" />
          Send
        </Button>
      </div>
    </div>
  );
}

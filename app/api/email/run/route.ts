import { NextResponse } from "next/server";

import { runOrchestratorChat } from "@/lib/agents/orchestrator";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      message?: string;
      mode?: "email" | "connection";
      selectedSourceId?: string;
    };

    if (!body.sessionId) {
      return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
    }

    const explicitIntent =
      body.mode === "connection" ? "draft_connection_message" : "draft_email";
    const result = await runOrchestratorChat({
      sessionId: body.sessionId,
      message:
        body.message?.trim() ||
        (body.mode === "connection"
          ? "Draft a LinkedIn connection message."
          : "Draft a networking email."),
      explicitIntent,
      selectedSourceId: body.selectedSourceId
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to draft email."
      },
      { status: 500 }
    );
  }
}

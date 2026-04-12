import { NextResponse } from "next/server";

import { runOrchestratorChat } from "@/lib/agents/orchestrator";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      message?: string;
      selectedSourceId?: string;
    };

    if (!body.sessionId) {
      return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
    }

    const result = await runOrchestratorChat({
      sessionId: body.sessionId,
      message: body.message?.trim() || "Analyze my match for the selected role.",
      explicitIntent: "analyze_match",
      selectedSourceId: body.selectedSourceId
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to run match analysis."
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";

import { runOrchestratorChat } from "@/lib/agents/orchestrator";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { sessionId?: string };
    if (!body.sessionId) {
      return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
    }

    const result = await runOrchestratorChat({
      sessionId: body.sessionId,
      message:
        "Parse my current sources, analyze my match for the selected opportunity, and optimize my resume.",
      addUserMessage: false
    });
    return NextResponse.json({
      session: result.session,
      artifacts: result.artifacts,
      match: result.session.matchReport,
      workflowTrace: result.workflowTrace
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to run the workflow."
      },
      { status: 500 }
    );
  }
}

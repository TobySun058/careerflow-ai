import { NextResponse } from "next/server";

import { runOrchestratorChat } from "@/lib/agents/orchestrator";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      message?: string;
      explicitIntent?: string;
      selectedJobId?: string;
      selectedResumeSourceId?: string;
      selectedSourceId?: string;
      selectedSourceIds?: string[];
      filters?: {
        location?: string;
        remote?: boolean;
        employmentType?: string;
        limit?: number;
      };
    };

    if (!body.sessionId || !body.message?.trim()) {
      return NextResponse.json(
        { error: "sessionId and message are required." },
        { status: 400 }
      );
    }

    const result = await runOrchestratorChat({
      sessionId: body.sessionId,
      message: body.message,
      explicitIntent: body.explicitIntent,
      selectedJobId: body.selectedJobId,
      selectedResumeSourceId: body.selectedResumeSourceId,
      selectedSourceId: body.selectedSourceId,
      selectedSourceIds: body.selectedSourceIds,
      filters: body.filters
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to process chat message."
      },
      { status: 500 }
    );
  }
}

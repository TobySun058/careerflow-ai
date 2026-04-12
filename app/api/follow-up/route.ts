import { NextResponse } from "next/server";

import { runSupervisorFollowUp } from "@/lib/agents/supervisor";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      instruction?: string;
    };
    if (!body.sessionId || !body.instruction?.trim()) {
      return NextResponse.json(
        { error: "sessionId and instruction are required." },
        { status: 400 }
      );
    }

    const result = await runSupervisorFollowUp(body.sessionId, body.instruction);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to run follow-up."
      },
      { status: 500 }
    );
  }
}

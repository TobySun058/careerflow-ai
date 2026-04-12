import { NextResponse } from "next/server";

import { runSupervisorWorkflow } from "@/lib/agents/supervisor";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { sessionId?: string };
    if (!body.sessionId) {
      return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
    }

    const result = await runSupervisorWorkflow(body.sessionId);
    return NextResponse.json(result);
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

import { NextResponse } from "next/server";

import { saveSelectedJobToSession } from "@/lib/agents/workers/job-search";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      jobId?: string;
    };

    if (!body.sessionId || !body.jobId) {
      return NextResponse.json(
        { error: "sessionId and jobId are required." },
        { status: 400 }
      );
    }

    const result = await saveSelectedJobToSession(body.sessionId, body.jobId);
    return NextResponse.json({
      session: result.session,
      source: result.source
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to save job."
      },
      { status: 500 }
    );
  }
}

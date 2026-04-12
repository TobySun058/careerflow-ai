import { NextResponse } from "next/server";

import { removeSourceFromSession } from "@/lib/agents/parse-ingest";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      sourceId?: string;
    };

    if (!body.sessionId || !body.sourceId) {
      return NextResponse.json(
        { error: "sessionId and sourceId are required." },
        { status: 400 }
      );
    }

    const result = await removeSourceFromSession(body.sessionId, body.sourceId);

    return NextResponse.json({ session: result.session });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to remove source."
      },
      { status: 500 }
    );
  }
}

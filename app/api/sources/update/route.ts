import { NextResponse } from "next/server";

import { updateSourceInSession } from "@/lib/agents/workers/source-ingest";
import { toPublicErrorMessage } from "@/lib/utils/public-error";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      sourceId?: string;
      title?: string;
      content?: string;
    };

    if (!body.sessionId || !body.sourceId) {
      return NextResponse.json(
        { error: "sessionId and sourceId are required." },
        { status: 400 }
      );
    }

    const result = await updateSourceInSession(body.sessionId, {
      sourceId: body.sourceId,
      title: body.title,
      content: body.content
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: toPublicErrorMessage(error, "Unable to update source.")
      },
      { status: 500 }
    );
  }
}

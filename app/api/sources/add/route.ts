import { NextResponse } from "next/server";

import { addSourceToSession } from "@/lib/agents/parse-ingest";
import { toPublicErrorMessage } from "@/lib/utils/public-error";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const sessionId = String(formData.get("sessionId") ?? "").trim();

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
    }

    const result = await addSourceToSession(sessionId, formData);

    return NextResponse.json({
      session: result.session,
      source: result.source
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: toPublicErrorMessage(error, "Unable to add source.")
      },
      { status: 500 }
    );
  }
}

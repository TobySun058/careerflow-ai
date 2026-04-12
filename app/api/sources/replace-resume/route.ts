import { NextResponse } from "next/server";

import { replaceResumeInSession } from "@/lib/agents/parse-ingest";
import { toPublicErrorMessage } from "@/lib/utils/public-error";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const sessionId = String(formData.get("sessionId") ?? "").trim();
    const sourceId = String(formData.get("sourceId") ?? "").trim();

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
    }

    const result = await replaceResumeInSession(sessionId, formData);

    return NextResponse.json({
      session: result.session,
      source: "source" in result ? result.source : undefined
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: toPublicErrorMessage(error, "Unable to replace resume.")
      },
      { status: 500 }
    );
  }
}

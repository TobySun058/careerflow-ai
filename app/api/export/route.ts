import { NextResponse } from "next/server";

import { getStorage } from "@/lib/storage";
import { exportArtifactsAsync } from "@/lib/tools/export";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      format?: "json" | "markdown" | "pdf";
    };

    if (!body.sessionId) {
      return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
    }

    const storage = getStorage();
    const session = await storage.getSession(body.sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const artifact = await exportArtifactsAsync(session, body.format ?? "markdown");
    return NextResponse.json(artifact);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to export session."
      },
      { status: 500 }
    );
  }
}

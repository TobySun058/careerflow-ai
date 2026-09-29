import { NextResponse } from "next/server";

import { buildAgentContext } from "@/lib/agents/shared";
import { deriveSearchQuery, searchJobs } from "@/lib/agents/workers/job-search";
import { getStorage } from "@/lib/storage";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      query?: string;
      filters?: Record<string, unknown>;
    };

    if (!body.sessionId) {
      return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
    }

    const storage = getStorage();
    const session = await storage.getSession(body.sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const chunks = await storage.getChunkIndex(body.sessionId);
    const context = buildAgentContext(session, chunks);
    const result = await searchJobs(context, {
      query: deriveSearchQuery(session, body.query),
      filters: body.filters
    });
    await storage.saveSession(session);

    return NextResponse.json({
      session,
      results: result.results,
      artifact: result.artifact
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to search jobs."
      },
      { status: 500 }
    );
  }
}

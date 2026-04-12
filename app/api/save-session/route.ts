import { NextResponse } from "next/server";

import { getStorage } from "@/lib/storage";
import { sessionRecordSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { session?: unknown };
    if (!body.session) {
      return NextResponse.json({ error: "session is required." }, { status: 400 });
    }

    const session = sessionRecordSchema.parse({
      ...body.session,
      updatedAt: new Date().toISOString()
    });
    const storage = getStorage();
    await storage.saveSession(session);

    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to save session."
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";

import { getStorage } from "@/lib/storage";

export async function GET() {
  try {
    const storage = getStorage();
    const sessions = await storage.listSessions();
    return NextResponse.json({ sessions });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load sessions."
      },
      { status: 500 }
    );
  }
}

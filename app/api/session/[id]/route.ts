import { NextResponse } from "next/server";

import { hasModelConfig } from "@/lib/config";
import { getStorage } from "@/lib/storage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const storage = getStorage();
    const session = await storage.getSession(id);
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    return NextResponse.json({ session, modelReady: hasModelConfig() });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load session."
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { title?: string };
    const nextTitle = body.title?.trim();

    if (!nextTitle) {
      return NextResponse.json({ error: "title is required." }, { status: 400 });
    }

    const storage = getStorage();
    const session = await storage.getSession(id);
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    session.title = nextTitle;
    session.updatedAt = new Date().toISOString();
    await storage.saveSession(session);

    return NextResponse.json({ session, modelReady: hasModelConfig() });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to rename session."
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const storage = getStorage();
    await storage.deleteSession(id);
    return NextResponse.json({ deletedId: id });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to delete session."
      },
      { status: 500 }
    );
  }
}

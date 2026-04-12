import { NextResponse } from "next/server";

import { getJobDiscoveryProvider } from "@/lib/providers/jobs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      query?: string;
      filters?: Record<string, unknown>;
    };
    if (!body.query?.trim()) {
      return NextResponse.json({ error: "query is required." }, { status: 400 });
    }

    const provider = getJobDiscoveryProvider();
    const results = await provider.searchJobs(body.query, body.filters);
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to search jobs."
      },
      { status: 500 }
    );
  }
}

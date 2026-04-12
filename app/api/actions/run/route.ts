import { NextResponse } from "next/server";

import { runOrchestratorChat } from "@/lib/agents/orchestrator";

function defaultActionMessage(action: string) {
  switch (action) {
    case "analyze_match":
      return "Analyze my match for the current role.";
    case "rewrite_resume":
    case "optimize_resume":
      return "Optimize my resume for the selected role.";
    case "draft_outreach":
    case "draft_email":
      return "Draft a networking email for this role.";
    case "draft_connection_message":
      return "Write a LinkedIn connection message for this role.";
    case "draft_cover_letter":
      return "Write a grounded cover letter for this role.";
    case "search_jobs":
      return "Find me similar jobs.";
    case "parse_sources":
      return "Parse my current sources.";
    case "save_job":
      return "Save this selected job.";
    case "generate_interview_prep":
      return "What should I prepare next for this opportunity?";
    case "build_plan":
      return "What should I do next for this opportunity?";
    case "finalize_resume":
      return "Optimize my resume for the selected role.";
    default:
      return "Run this action.";
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      action?: string;
      message?: string;
      selectedJobId?: string;
      selectedResumeSourceId?: string;
      selectedSourceId?: string;
      selectedSourceIds?: string[];
      filters?: {
        location?: string;
        remote?: boolean;
        employmentType?: string;
        limit?: number;
      };
    };

    if (!body.sessionId || !body.action) {
      return NextResponse.json(
        { error: "sessionId and action are required." },
        { status: 400 }
      );
    }

    const result = await runOrchestratorChat({
      sessionId: body.sessionId,
      message: body.message?.trim() || defaultActionMessage(body.action),
      explicitIntent: body.action,
      selectedJobId: body.selectedJobId,
      selectedResumeSourceId: body.selectedResumeSourceId,
      selectedSourceId: body.selectedSourceId,
      selectedSourceIds: body.selectedSourceIds,
      filters: body.filters
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to run action."
      },
      { status: 500 }
    );
  }
}

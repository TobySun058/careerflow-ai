from __future__ import annotations

import json
import os
import re
from typing import cast

from .models import AllowedIntent, PlanRequest, PlanResponse

try:
    from crewai import Agent, Crew, Process, Task
except Exception:  # pragma: no cover - graceful local fallback
    Agent = None
    Crew = None
    Process = None
    Task = None


ALLOWED_INTENTS: tuple[AllowedIntent, ...] = (
    "parse_sources",
    "search_jobs",
    "save_job",
    "analyze_match",
    "optimize_resume",
    "draft_email",
    "draft_connection_message",
    "draft_cover_letter",
    "general_grounded_qa",
)


def _ordered_unique(intents: list[str]) -> list[AllowedIntent]:
    seen: set[str] = set()
    ordered: list[AllowedIntent] = []
    for intent in intents:
        if intent in seen or intent not in ALLOWED_INTENTS:
            continue
        ordered.append(cast(AllowedIntent, intent))
        seen.add(intent)
    return ordered


def _fallback_plan(request: PlanRequest) -> PlanResponse:
    lowered = request.message.lower()
    intents: list[str] = []

    if re.search(r"(parse|reparse|ingest).*(resume|source|sources|job description|job posting)", lowered):
        intents.append("parse_sources")
    if re.search(r"(find|search).*(job|jobs|role|roles|internship|internships)", lowered):
        intents.append("search_jobs")
    if re.search(r"\bsave\b.*(job|role|listing)", lowered):
        intents.append("save_job")
    if re.search(r"(fit|match|gap|qualified|should i apply|am i a fit)", lowered):
        intents.append("analyze_match")
    if re.search(r"(optimize|tailor|rewrite|revise|change|update|improve|edit|fix|refine|adjust).*(resume|cv)", lowered):
        intents.append("optimize_resume")
    if "resume" in lowered and re.search(r"(for|toward|target|match for|fit for).*(job|role|internship|posting|opportunity)", lowered):
        intents.append("optimize_resume")
    if re.search(r"(email|outreach|follow-up|follow up|recruiter)", lowered):
        intents.append("draft_email")
    if re.search(r"(linkedin|connection message|connect note|connection note)", lowered):
        intents.append("draft_connection_message")
    if re.search(r"(cover letter|application letter)", lowered):
        intents.append("draft_cover_letter")

    if not intents:
        intents = request.fallbackIntents or ["general_grounded_qa"]

    return PlanResponse(
        intents=_ordered_unique(intents),
        explanation="Fallback planner used local rules because CrewAI was unavailable."
    )


def _extract_json(text: str) -> dict:
    text = text.strip()
    if not text:
        return {}

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                return {}
        return {}


def _crew_available() -> bool:
    return all(
        [
            Agent,
            Crew,
            Process,
            Task,
            os.getenv("OPENAI_API_KEY")
            or os.getenv("ANTHROPIC_API_KEY")
            or os.getenv("GEMINI_API_KEY")
            or os.getenv("MODEL"),
        ]
    )


def plan_with_crewai(request: PlanRequest) -> PlanResponse:
    if not _crew_available():
        return _fallback_plan(request)

    router = Agent(
        role="Intent Router",
        goal="Infer which backend worker intents the user actually needs.",
        backstory=(
            "You translate natural language career-workspace requests into a minimal set "
            "of backend intents without inventing new capabilities."
        ),
        allow_delegation=False,
        verbose=False,
    )

    readiness_analyst = Agent(
        role="Readiness Analyst",
        goal="Check whether the current session has the sources needed for each possible action.",
        backstory=(
            "You look at active resume state, selected opportunity state, and source inventory "
            "to avoid selecting actions that the session cannot support."
        ),
        allow_delegation=False,
        verbose=False,
    )

    planner = Agent(
        role="Execution Planner",
        goal="Return the best ordered backend plan for this user request.",
        backstory=(
            "You combine intent routing and readiness checks into a short plan that the "
            "Next.js orchestrator can execute deterministically."
        ),
        allow_delegation=False,
        verbose=False,
    )

    router_task = Task(
        description=(
            "Classify the user's request into one or more allowed intents.\n"
            f"Allowed intents: {', '.join(request.allowedIntents or ALLOWED_INTENTS)}\n"
            f"User message: {request.message}\n"
            f"Fallback intents: {', '.join(request.fallbackIntents)}\n"
            "Return JSON with keys intents and explanation."
        ),
        expected_output='{"intents":["..."],"explanation":"..."}',
        agent=router,
    )

    readiness_task = Task(
        description=(
            "Analyze whether the session is ready for optimization, matching, email drafting, "
            "or job search.\n"
            f"Session snapshot: {request.session.model_dump_json()}\n"
            "Call out whether an active resume or selected opportunity is missing.\n"
            "Return JSON with keys intents and explanation."
        ),
        expected_output='{"intents":["..."],"explanation":"..."}',
        agent=readiness_analyst,
    )

    planner_task = Task(
        description=(
            "Combine the router and readiness outputs into a final ordered intent plan.\n"
            "Rules:\n"
            "- Prefer optimize_resume when the user asks to rewrite/change/improve a resume for a role.\n"
            "- Prefer analyze_match when the user asks about fit, gaps, or qualification.\n"
            "- Use search_jobs only for discovery.\n"
            "- Use save_job only when the user explicitly wants to save a result.\n"
            "- If nothing else fits, use general_grounded_qa.\n"
            "- Return JSON only with keys intents and explanation."
        ),
        expected_output='{"intents":["..."],"explanation":"..."}',
        agent=planner,
        context=[router_task, readiness_task],
    )

    crew = Crew(
        agents=[router, readiness_analyst, planner],
        tasks=[router_task, readiness_task, planner_task],
        process=Process.sequential,
        verbose=False,
    )

    result = crew.kickoff()
    payload = _extract_json(str(result))
    intents = _ordered_unique(payload.get("intents", []))

    if not intents:
        return _fallback_plan(request)

    explanation = payload.get("explanation")
    return PlanResponse(
        intents=intents,
        explanation=explanation if isinstance(explanation, str) and explanation.strip() else "CrewAI planner selected the current worker sequence."
    )

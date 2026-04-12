from __future__ import annotations

import os

import uvicorn
from fastapi import FastAPI

from .models import PlanRequest, PlanResponse
from .planner import plan_with_crewai


app = FastAPI(title="CareerFlow CrewAI Bridge", version="0.1.0")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/plan", response_model=PlanResponse)
async def plan(request: PlanRequest) -> PlanResponse:
    return plan_with_crewai(request)


def main() -> None:
    uvicorn.run(
        "careerflow_crewai_bridge.app:app",
        host=os.getenv("CREWAI_BRIDGE_HOST", "127.0.0.1"),
        port=int(os.getenv("CREWAI_BRIDGE_PORT", "8787")),
        reload=False,
    )


if __name__ == "__main__":
    main()

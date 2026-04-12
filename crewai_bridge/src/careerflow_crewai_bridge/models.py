from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


AllowedIntent = Literal[
    "parse_sources",
    "search_jobs",
    "save_job",
    "analyze_match",
    "optimize_resume",
    "draft_email",
    "draft_connection_message",
    "draft_cover_letter",
    "general_grounded_qa",
]


class SourceSummary(BaseModel):
    id: str
    title: str
    kind: str
    type: str
    active: bool = False
    provider: str | None = None


class ArtifactSummary(BaseModel):
    id: str
    type: str
    title: str


class JobResultSummary(BaseModel):
    id: str
    title: str
    company: str
    location: str
    savedSourceId: str | None = None


class SessionSnapshot(BaseModel):
    id: str
    title: str
    activeResumeSourceId: str | None = None
    selectedOpportunitySourceId: str | None = None
    hasParsedResumeProfile: bool = False
    hasSelectedOpportunityProfile: bool = False
    activeResumeTitle: str | None = None
    selectedOpportunityTitle: str | None = None
    sources: list[SourceSummary] = Field(default_factory=list)
    artifacts: list[ArtifactSummary] = Field(default_factory=list)
    savedJobSearchResults: list[JobResultSummary] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class PlanRequest(BaseModel):
    message: str
    explicitIntent: str | None = None
    selectedJobId: str | None = None
    selectedResumeSourceId: str | None = None
    selectedSourceId: str | None = None
    selectedSourceIds: list[str] = Field(default_factory=list)
    fallbackIntents: list[AllowedIntent] = Field(default_factory=list)
    allowedIntents: list[AllowedIntent] = Field(default_factory=list)
    session: SessionSnapshot


class PlanResponse(BaseModel):
    handled: bool = True
    intents: list[AllowedIntent] = Field(default_factory=list)
    explanation: str | None = None

# Architecture

CareerFlow is organized around one principle: **separate orchestration from evidence and external tools**.

## Request lifecycle

1. The user interacts with the Next.js workspace.
2. `OrchestratorAgent` resolves one or more intents.
3. Worker agents execute domain-specific steps.
4. Retrieval supplies evidence from the correct corpus.
5. Optional MCP adapters call external tools.
6. Results are written back to the persistent session as messages, artifacts, saved jobs, or workflow trace entries.

## Agent responsibilities

### OrchestratorAgent

Single entry point for chat and action requests. It resolves explicit actions or inferred intents and delegates work to the appropriate worker.

### ParseIngestAgent

Parses resumes, job descriptions, pasted text, and supported source inputs. It rebuilds source indexes and candidate/opportunity state as needed.

### JobSearchAgent

Builds search queries, calls a configured job-search adapter when available, normalizes results, and saves selected jobs into the opportunity corpus.

### MatchOptimizeAgent

Compares the candidate profile with the selected opportunity and produces grounded match analysis and resume-edit guidance.

### EmailConnectAgent

Drafts recruiter email, connection messages, and cover letters from retrieved candidate and opportunity evidence.

## Evidence boundaries

CareerFlow intentionally separates:

- **truth evidence**: facts about the candidate;
- **opportunity evidence**: facts about the role or company.

Retrieval functions query these domains independently. This makes provenance easier to inspect and reduces accidental cross-contamination of claims.

## Storage

The default implementation is local and session-oriented. Each session can persist:

- source manifest;
- active resume;
- saved opportunity sources;
- parsed candidate profile;
- selected opportunity profile;
- job search results;
- match reports;
- chat history;
- artifacts;
- workflow trace.

The storage interface is abstracted so another persistence backend can be added without changing agent logic.

## MCP boundary

External services are accessed through typed adapters under `lib/mcp/`. The application does not assume those services are present. Each adapter reports configuration status and can fail independently, allowing the core workflow to fall back when possible.

## Optional planner

The CrewAI bridge is a separate Python service. When enabled, it can propose a plan for compound requests. The Next.js application remains the execution host and system of record.

This separation keeps the primary path deterministic enough for local use while leaving room for more autonomous planning experiments.

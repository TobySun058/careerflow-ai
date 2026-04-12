# CareerFlow AI

CareerFlow AI is a hackathon-ready, evidence-first, NotebookLM-style career workspace built with Next.js App Router, TypeScript, Tailwind CSS, and shadcn-style UI primitives.

The interface stays simple:

- left rail: sources
- center rail: grounded chat
- right rail: explicit actions, workflow trace, and latest artifacts

The backend is now simplified around one orchestrator plus four worker agents, with MCP adapters as the primary integration layer.

An optional CrewAI bridge can be enabled for more autonomous intent planning. In that mode, the Next.js backend stays the execution host, while a Python CrewAI sidecar proposes the worker-agent sequence for each chat request.

## What it does

- Upload a resume and supporting files
- Paste raw text or add a URL source
- Replace the active resume or remove sources from a session
- Keep user facts and opportunity facts isolated with dual corpora
- Search jobs, review multiple results, and selectively save jobs into the opportunity corpus
- Analyze match, optimize a resume, and draft grounded outreach
- Persist chat history, artifacts, workflow trace, sources, saved jobs, and parsed state per session

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Local-first JSON storage
- Featherless OpenAI-compatible API for open-source model inference
- MCP-first adapters for Resumake, JobSpy, and Decodo

## Getting started

1. Install dependencies

```bash
npm install
```

2. Copy the environment file

```bash
cp .env.example .env
```

3. Minimum local setup

```env
FEATHERLESS_API_KEY=your_key_here
```

4. Optional MCP setup

```env
MCP_TRANSPORT=http-json
ENABLE_RESUMAKE_MCP=true
RESUMAKE_MCP_COMMAND=node
RESUMAKE_MCP_ARGS=["path/to/resumake-mcp/server.js"]
RESUMAKE_MCP_CWD=path/to/resumake-mcp
ENABLE_JOBSPY_MCP=true
JOBSPY_MCP_COMMAND=node
JOBSPY_MCP_ARGS=["path/to/jobspy-mcp-server/src/index.js"]
JOBSPY_MCP_CWD=path/to/jobspy-mcp-server
ENABLE_DECODO_MCP=true
DECODO_API_KEY=your_key_here
DECODO_MCP_URL=https://your-decodo-mcp-endpoint
```

5. Start the app

```bash
npm run dev
```

6. Open `http://localhost:3000`

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run typecheck`

## Storage modes

### Local

Default mode. Sessions, source manifests, and chunk indexes are stored in:

- `data/local/sessions`
- `data/local/sources`
- `data/local/indexes`

### Firebase

An adapter boundary is included, but the MVP defaults to local mode unless you extend the Firebase adapter with credentials and persistence logic.

## Environment variables

See `.env.example` for the full list.

Important flags:

- `MCP_TRANSPORT`
- `FEATHERLESS_API_KEY`
- `FEATHERLESS_BASE_URL`
- `FEATHERLESS_MODEL`
- `FEATHERLESS_EMBED_MODEL`
- `ENABLE_RESUMAKE_MCP`
- `RESUMAKE_MCP_COMMAND`
- `RESUMAKE_MCP_ARGS`
- `RESUMAKE_MCP_CWD`
- `RESUMAKE_TEMPLATE_NUMBER`
- `ENABLE_JOBSPY_MCP`
- `JOBSPY_MCP_COMMAND`
- `JOBSPY_MCP_ARGS`
- `JOBSPY_MCP_CWD`
- `JOBSPY_SITE_NAMES`
- `JOBSPY_COUNTRY_INDEED`
- `JOBSPY_FETCH_LINKEDIN_DESCRIPTION`
- `ENABLE_DECODO_MCP`
- `DECODO_API_KEY`
- `DECODO_MCP_URL`
- `ENABLE_CREWAI_BRIDGE`
- `CREWAI_BRIDGE_URL`
- `CREWAI_BRIDGE_TIMEOUT_MS`
- `APP_URL`
- `STORAGE_MODE`
- `LOCAL_DATA_DIR`
- `ENABLE_EMBEDDINGS`

## Architecture

### Agents

- `OrchestratorAgent`
- `ParseIngestAgent`
- `JobSearchAgent`
- `MatchOptimizeAgent`
- `EmailConnectAgent`

Flow:

- chat or action -> `OrchestratorAgent`
- orchestrator -> one or more of parse/ingest, job search, match/optimize, email/connect
- worker agent -> MCP adapter first, local fallback second
- outputs -> session state, artifacts, workflow trace, grounded chat response

### MCP adapters

- `Resumake MCP`
  - preferred for final resume PDF generation and template-based export
- `JobSpy MCP`
  - preferred for job search across Indeed, LinkedIn, Glassdoor, and related sources
- `Decodo MCP`
  - preferred for URL extraction and page enrichment

All MCP integration logic is centralized under `lib/mcp/*`. The app backend acts as the orchestration host and falls back gracefully when an MCP is unavailable.

### Optional CrewAI planning bridge

If you want more autonomous multi-agent routing, enable the Python CrewAI sidecar in [`crewai_bridge/README.md`](./crewai_bridge/README.md).

Recommended shape:

- Next.js remains the system of record for sessions, storage, retrieval, MCP adapters, and artifact persistence
- CrewAI acts as a planner for ambiguous or compound chat requests
- the Node orchestrator executes the returned plan with the existing worker agents

This keeps the current frontend and backend execution stable, while adding real multi-agent collaboration where it helps most.

### Grounding model

- Truth corpus: active resume, supporting user documents, pasted notes about the user
- Opportunity corpus: job descriptions, saved job listings, company pages, and URL-derived opportunity content

Rules:

- user facts come from truth sources only
- role and company facts come from opportunity sources only
- unsupported claims are downgraded or filtered by the claim checker

### Retrieval

- chunking with metadata
- embeddings when a Featherless-compatible embedding model is configured
- lexical fallback when embeddings are unavailable
- top-k evidence retrieval with source references

### Session model

Each local session stores:

- `sources[]`
- `activeResumeSourceId`
- `savedOpportunitySourceIds[]`
- `chatHistory[]`
- `parsedResumeProfile`
- `savedJobSearchResults[]`
- `selectedOpportunityProfile`
- `matchReport` and `matchReports[]`
- `artifacts[]`
- `workflowTrace[]`
- timestamps and notes

## API routes

- `POST /api/ingest`
- `POST /api/chat`
- `POST /api/actions/run`
- `POST /api/sources/add`
- `POST /api/sources/replace-resume`
- `POST /api/sources/remove`
- `POST /api/jobs/search`
- `POST /api/jobs/save`
- `POST /api/match/run`
- `POST /api/email/run`
- `POST /api/export`
- `POST /api/save-session`
- `GET /api/session/[id]`
- `GET /api/sessions`

Compatibility routes:

- `POST /api/follow-up`
- `POST /api/job-search`
- `POST /api/run-workflow`

## Demo data

Sample seed content lives in `data/sample/demo.json`.

Use the "Load demo data" button on the home page for a quick end-to-end demo.

## Notes

- The app is still useful when optional adapters are disabled.
- Featherless powers open-ended grounded generation and local fallback prompts.
- Job search falls back to seeded manual job results when JobSpy MCP is unavailable.
- Resume parsing and match guidance use local grounded logic.
- Resumake MCP is used for final PDF-style resume export when configured.
- URL extraction falls back to direct fetch-and-clean when Decodo MCP is unavailable.
- The main demo path is: create or load a session, review sources in the left rail, chat in the center, search and save a job, then run match, optimize, or email actions from the right rail.

# CareerFlow AI

CareerFlow AI is a hackathon-ready, evidence-first career application workflow built with Next.js App Router, TypeScript, Tailwind CSS, and shadcn-style UI primitives.

The product is designed for the Agentic AI track and focuses on grounded, multi-agent career workflows rather than generic chat.

## What it does

- Upload a resume
- Paste a job description or job URL
- Separate user facts from role/company facts with dual corpora
- Run a supervisor plus specialist agents for:
  - fit analysis
  - resume bullet rewriting
  - outreach drafts
  - interview prep
  - next-step planning
- Surface lightweight evidence chips and workflow trace data for major outputs

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Local-first JSON storage
- Gemini API for generation and optional embeddings
- Graceful fallbacks when optional providers are unavailable

## Getting started

1. Install dependencies

```bash
npm install
```

2. Copy the environment file and add your Gemini key

```bash
cp .env.example .env
```

3. Set at least:

```env
GOOGLE_GEMINI_API_KEY=your_key_here
```

4. Start the app

```bash
npm run dev
```

5. Open `http://localhost:3000`

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

- `GOOGLE_GEMINI_API_KEY`
- `GOOGLE_GEMINI_MODEL`
- `GOOGLE_GEMINI_EMBED_MODEL`
- `STORAGE_MODE`
- `LOCAL_DATA_DIR`
- `JOB_DISCOVERY_MODE`
- `RESUME_OPTIMIZER_MODE`
- `CV_STYLING_MODE`
- `ENABLE_EMBEDDINGS`

## Architecture

### Agents

- `SupervisorAgent`
- `ResumeEvidenceAgent`
- `RoleResearchAgent`
- `MatchAgent`
- `ApplicationWriterAgent`
- `InterviewPrepAgent`
- `PlannerAgent`

### Grounding model

- Truth Store: resume, approved bullets, interview stories, user facts
- Opportunity Store: job description, parsed job URL, company/job content, discovery results

Rule of thumb:

- candidate claims come from truth sources only
- role/company claims come from opportunity sources only
- unsupported claims are downgraded or filtered by the claim checker

### Retrieval

- chunking with metadata
- embeddings when Gemini embeddings are available
- lexical fallback when embeddings are unavailable
- top-k evidence retrieval with source references

## API routes

- `POST /api/ingest`
- `POST /api/run-workflow`
- `POST /api/follow-up`
- `POST /api/job-search`
- `POST /api/export`
- `POST /api/save-session`
- `GET /api/session/[id]`
- `GET /api/sessions`

## Demo data

Sample seed content lives in `data/sample/demo.json`.

Use the "Load demo data" button on the home page for a quick end-to-end demo.

## Notes

- The app is built to remain useful even if optional adapters are disabled.
- The job search adapter defaults to a manual provider with seeded example jobs.
- Firebase, Dice, styled resume export, and third-party resume optimization are intentionally adapterized and non-blocking.

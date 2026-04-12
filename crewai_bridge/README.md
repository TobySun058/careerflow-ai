# CareerFlow CrewAI Bridge

This is an optional Python sidecar for more autonomous multi-agent planning in CareerFlow AI.

It does not replace the Next.js backend. Instead:

- Next.js remains the MCP host, storage layer, and execution runtime
- the CrewAI bridge receives a compact session snapshot
- CrewAI agents collaborate on intent planning
- the Node orchestrator executes the returned plan with the existing worker agents

## Why this shape

CrewAI is officially a Python framework, while the main app backend is Next.js + TypeScript.  
That means the safest adoption path is a sidecar bridge, not a direct in-process swap.

## What the bridge does

- accepts `POST /plan`
- reviews the current session snapshot
- proposes one or more orchestrator intents
- returns a short explanation for the workflow trace

## Local setup

1. Create a virtual environment and install dependencies

```bash
uv sync
```

2. Set environment variables for the LLM CrewAI should use

Examples depend on your CrewAI provider setup. Common options include:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `MODEL`

3. Run the bridge

```bash
uv run careerflow-crewai-bridge
```

4. In the main app `.env`

```env
ENABLE_CREWAI_BRIDGE=true
CREWAI_BRIDGE_URL=http://127.0.0.1:8787
```

## Notes

- If the bridge is unavailable, the Next.js app falls back to its local TypeScript router.
- The current bridge is intentionally narrow: planning only.
- MCP execution still stays in the Next.js backend so existing Resume Optimizer Pro, Dice, and Decodo adapters keep working.

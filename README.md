# AI Agents Frontend

A basic Next.js front-end starter.

## Development

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000 to view the app.

This project uses the Next.js App Router. The main page lives in `app/page.tsx`.

## A1 Agent Brief

The marketing dashboard derives A1 endpoints from `NEXT_PUBLIC_DASHBOARD_API_URL`.
Override them when needed:

```text
NEXT_PUBLIC_A1_AGENT_LATEST_URL=http://localhost:3002/api/agents/a1-kcars-performance-agent/latest
NEXT_PUBLIC_A1_AGENT_RERUN_URL=http://localhost:3002/api/agents/a1-kcars-performance-agent/rerun
```

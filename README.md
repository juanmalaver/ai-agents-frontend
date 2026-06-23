# AI Agents Frontend

A basic Next.js front-end starter.

## Development

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000 to view the app.

This project uses the Next.js App Router. The main page lives in `app/page.tsx`.

## Auth

The dashboard uses `ai-agents-backend` for CRM-backed auth. For local Google
sign-in, use:

```env
NEXT_PUBLIC_DASHBOARD_API_URL=http://localhost:3002/marketing-dashboard
NEXT_PUBLIC_AUTH_API_URL=http://localhost:3002/auth
```

Register this Google OAuth redirect URI for local development:

```text
http://localhost:3000/auth/google/redirect
```

## A1 Agent Brief

The marketing dashboard derives A1 endpoints from `NEXT_PUBLIC_DASHBOARD_API_URL`.
Override them when needed:

```text
NEXT_PUBLIC_A1_AGENT_LATEST_URL=http://localhost:3002/api/agents/a1-kcars-performance-agent/latest
NEXT_PUBLIC_A1_AGENT_RERUN_URL=http://localhost:3002/api/agents/a1-kcars-performance-agent/rerun
```

## Video Approvals

The Video Approvals page proxies review API calls through this Next app so the
video review secret stays server-side:

```env
AUTH_API_URL=http://localhost:3002/auth
VIDEO_PRODUCTION_AGENT_API_URL=http://localhost:8000
VIDEO_REVIEW_WEBHOOK_SECRET=local-review-secret
```

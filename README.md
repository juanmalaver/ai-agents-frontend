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

The Video Approvals page calls `ai-agents-backend` through the local Next API
route. The backend then talks to the Video Production Agent, so the video
microservice URL and review secret stay server-side in `ai-agents-backend`:

```env
NEXT_PUBLIC_DASHBOARD_API_URL=http://localhost:3002/marketing-dashboard
```

If the dashboard API URL is not enough in a deployment, set
`VIDEO_PRODUCTION_BACKEND_API_URL` to the backend base path for video routes,
for example `http://localhost:3002/api/video-production`.

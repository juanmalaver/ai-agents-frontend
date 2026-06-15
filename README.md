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
NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true
```

Register this Google OAuth redirect URI for local development:

```text
http://localhost:3000/auth/google/redirect
```

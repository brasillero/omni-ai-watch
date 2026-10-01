<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project: omni-ai-watch

App to monitor AI usage across multiple plans on multiple AI providers.

## Stack
- Next.js 16 (Turbopack, App Router, TypeScript) — check `node_modules/next/dist/docs/` before using any Next API
- shadcn/ui on Base UI — always import UI from `@/components/ui/*`
- TanStack Query 5 (provider in `app/providers.tsx`) for client data fetching

## Structure
- `lib/providers/` — provider integration layer. `types.ts` defines the
  `UsageProvider` interface (`fetchUsage`, optional `fetchCosts`); one file
  per provider (OpenAI, Anthropic); `registry.ts` maps provider ids to
  implementations and builds config from env. Providers normalize vendor
  responses into `UsageBucket`/`CostBucket` (USD only).
- `app/api/` — route handlers: `/api/providers` (registry status),
  `/api/usage?provider=&start=&end=` (pull usage through a provider),
  `/api/ingest` (POST webhook for pushing usage events).
- Credentials come from env vars (`OPENAI_ADMIN_API_KEY`,
  `ANTHROPIC_ADMIN_API_KEY`, `ANTHROPIC_ORGANIZATION_ID`) — usage/cost
  endpoints require organization Admin keys, not project keys.
- TODO: persist ingested usage — storage/data model not decided yet
  (marked in `app/api/ingest/route.ts`).

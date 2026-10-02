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

## Delegating to other agents

- **Give tools, not scripts.** When asking another agent (Codex, Claude,
  Kimi, …) to do something — e.g. comment on a PR, deploy, inspect state —
  tell it WHICH tools are available ("use `gh` to post review comments on
  the PR") and what the goal is, and let the agent work out the exact
  commands itself. Do not pre-build helper scripts/wrappers for it: they
  hide mechanics, encode assumptions, and when they break they mislead
  every agent that relies on them. Applies to most delegated work, not
  just PR reviews.
- Orchestrator owns final review: verify delegated results (run tests,
  read the diff) before accepting them.

## Diagnose before acting
A message that asks to see, check, investigate, or explain something is a request for diagnosis. The reply is the finding plus a proposed fix (if makes sense); editing code starts only after an explicit go-ahead. An imperative ("change", "remove", "use") is the go-ahead.

## Model selection
Sonnet" means the latest Sonnet. This applies to the main session, subagents, and any tool that model parameter. The defaults below only apply when the user has not said which model to use.

## Claude Code subagent guidance

Generally speaking, you should use the currently select model, But if you have a specific reason to use a different model, ask and I will approve. Never use Haiku or Sonnet for subagents. 

## Approvals

Generally speaking, I approve of the actions, commands, and tools required to complete the task I requested.

For example, if I ask you to show me an HTML write-up, I expect you to publish that HTML if necessary. If I ask you to create a UI pull request with screenshots, I expect you to upload those screenshots and include them in the description. These are examples, not an exhaustive list. Use your judgment to apply the same principle to similar situations.

Approve the commands and tools needed to complete the task. Ask me first only when there is a real concern about exposing sensitive information or an action goes far beyond what I requested in an irreversible way.

When a step doesn't need my input, keep going. Put status notes in the same message as your next action.
Stop and ask only when you can't continue without me, or before anything destructive: deleting data, force-pushing, or changing anything outside this repository.

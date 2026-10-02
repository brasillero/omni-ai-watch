# omni-ai-watch

App to monitor AI usage across multiple plans on multiple AI providers.

Local-first: runs on your machine, credentials stay in `.env.local`.

## Run locally

```bash
pnpm install
pnpm dev
```

Open http://127.0.0.1:3000. The dev/start scripts bind to loopback
(`--hostname 127.0.0.1`) by default — the API routes are intentionally
authless, so keep it that way.

## Provider credentials

Usage/cost endpoints require organization **Admin** keys, not regular
project keys. Copy `.env.example` to `.env.local` (or create it) and fill in
what you have — unconfigured providers show a setup hint on the dashboard.

| Env var | Provider | Required |
|---|---|---|
| `OPENAI_ADMIN_API_KEY` | OpenAI (`sk-admin-...`) | yes, for OpenAI |
| `ANTHROPIC_ADMIN_API_KEY` | Anthropic (`sk-ant-admin01-...`) | yes, for Anthropic |
| `ANTHROPIC_ORGANIZATION_ID` | Anthropic (`org_...`) | only if the key belongs to multiple orgs |

Restart the dev server after changing `.env.local`.

## Layout

- `lib/providers/` — provider integrations (one file per provider + registry)
- `app/api/` — `/api/providers`, `/api/usage`, `/api/ingest`
- `docs/ROADMAP.md` — phased implementation plan
- `components/ui/` — shadcn/ui (Base UI) components


# omni-ai-watch

> **ARCHIVED (2026-10-01) — the original goal is not achievable.**
>
> This project set out to track spending/usage of AI **subscription plans**
> (Claude Pro/Max 5h & weekly windows, ChatGPT plans, Kimi) in one place.
> Investigation showed this is not possible through sanctioned means:
>
> - **Anthropic** — plan quotas are only readable via an undocumented OAuth
>   endpoint, and Anthropic's terms **prohibit third-party apps from offering
>   Claude.ai login or storing/intermediating Claude.ai tokens**. The only
>   documented channel (the Claude Code statusline) is local and tied to
>   Claude Code activity. See
>   [code.claude.com/docs/en/legal-and-compliance](https://code.claude.com/docs/en/legal-and-compliance).
> - **OpenAI** — no API exists for ChatGPT plan quotas/spending at all.
> - **Kimi/Moonshot** — an official API exposes account *balance* only;
>   subscription quotas have no official remote API.
>
> Subscription prices are fixed and already known; what cannot be tracked is
> *plan utilization*. With that gone, the tool's core value disappeared.
>
> **What still works** (kept for reference): API *usage/cost* tracking via
> official organization Admin APIs (OpenAI + Anthropic adapters, dashboard,
> tests), documented in `docs/ROADMAP.md`. `docs/ROADMAP.md` also records the
> full phased plan, the provider findings, and the security/credentials
> decisions — useful to anyone revisiting this problem.

---

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


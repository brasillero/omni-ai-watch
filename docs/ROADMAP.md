# omni-ai-watch implementation roadmap

Research checked on **2026-10-01**; re-prioritized the same day to make plan/subscription quotas the main track. Provider credentials and live account responses were not tested.

## 1. Phased implementation plan

**Re-prioritized 2026-10-01.** The product goal is **plan/subscription quota monitoring** — the 5-hour rolling window, weekly limits, and similar caps on Claude Pro/Max-style subscriptions — across providers. API usage is not subscription usage: organization Admin usage APIs report pay-as-you-go API activity and say nothing about plan quotas. The plan has two tracks:

- **Main track — plan quotas (Phases 1–4).** Built on OAuth-based subscription connectors and user-defined quotas.
- **Side track — API usage (deferred).** The existing Admin-API adapters, dashboard, tests, `/api/usage`, and `/api/providers` stay in the repo and keep working, but are not the priority. See Section 1b.

Implement one phase at a time. **Phase 1 is a useful stopping point**; later architecture must not become a prerequisite for displaying a quota.

### Credential and security decisions (apply to every phase)

- Credentials (OAuth tokens, API keys) are stored **server-side only**: a local SQLite store with secrets held in the OS keyring (a minimal file-based server-side store is acceptable until SQLite lands, never committed and never sent to the browser).
- The browser holds only an **opaque session cookie**. Never put keys or tokens in cookies, `localStorage`, or client bundles.
- The app binds to **127.0.0.1** by default (`pnpm dev`/`pnpm start` already do).
- No local companion components, no private-console scraping, no browser-cookie harvesting.

## 1a. Main track — plan/subscription quota monitoring

### Phase 1 — Anthropic reported quota snapshot

**Scope:** The smallest useful subscription-quota milestone: show one Claude Pro/Max account's provider-reported windows.

**Deliverables:**

- Anthropic OAuth login (Claude Code-style flow, `org:admin` scope) started from the app; the callback exchanges the code server-side.
- A minimal server-side token store per the security decisions above, including refresh-token handling and an explicit "re-login required" state.
- A `fetchQuotaSnapshot` capability and adapter for Anthropic's reported subscription utilization (5h and weekly windows, utilization ratio, reset times). The endpoint is undocumented but used by first-party clients — isolate it behind the adapter and validate the response shape at runtime.
- A `/api/quotas` route returning the normalized snapshot (no tokens in the response).
- A minimal UI: one card per reported window showing used/remaining percentage, reset time (absolute and relative), fetched-at time, and loading/error/unauthenticated states. Manual refresh only.

**NOT in this phase:**

- Other providers, multiple accounts, connection-management screens, persistence of history, notifications, or polling.
- Translating reported ratios into tokens or combining them with API-usage data.

**Exit gate:** After logging in, the displayed 5h and weekly utilization and reset times match what Claude reports for the same account. Tokens never appear in browser storage, network responses, or logs. Fixture tests cover snapshot parsing and missing/unknown windows; lint, typecheck, and build pass.

### Phase 2 — Connection and credential management

**Scope:** Make subscription connections manageable instead of single-shot.

**Deliverables:**

- A connections UI: add, rename, re-authenticate, and remove connections; show status (connected, expired, error) and last successful fetch.
- Move the token store to SQLite + OS keyring with versioned migrations; no ORM required.
- Capability metadata per connector: reported quotas, balance, historical usage. Unsupported capabilities render an explicit unavailable state.
- Multiple Anthropic accounts side by side; quota snapshots stored with fetched-at time so the last good value survives a failed refresh.
- Add Moonshot's official balance connector (`api.moonshot.ai/v1/users/me/balance`) — remote, official, no local components. Shown as a balance, not a quota.

**NOT in this phase:**

- User-defined quotas, history charts, forecasting, or notifications.
- **Kimi subscription quotas: ON HOLD.** The only quota-reporting surfaces are the experimental local `kimi web` server API (rejected — must not depend on a local component) and the undocumented hosted `/usages` endpoint (rejected — no official contract). Revisit only if Moonshot publishes an official remote API; until then Kimi shows balance only.

**Exit gate:** Connections survive restart; removing a connection deletes its secret from the keyring; an expired token produces a re-login prompt rather than a blank card.

### Phase 3 — User-defined quotas for providers without reported quotas

**Scope:** Track plans whose provider exposes no quota API — notably OpenAI/ChatGPT, which has **no plan-quota API at all**.

**Deliverables:**

- User-defined quota definitions (Section 4): label, scope, metric, limit, and rolling/weekly/monthly/total window, with reset anchors and timezone.
- Manual observations: the user records a reading ("ChatGPT Plus: 60% of weekly limit at 14:00") or a budget; the app shows it with its observation time and ages it explicitly.
- Optional derived measurements where a real signal exists (e.g. captured request tokens via `/api/ingest`, or API-usage buckets from the side track) — always labeled with their source and coverage.
- Unified quota cards that render provider-reported and user-defined quotas with the same layout but a visible measurement-source label.

**NOT in this phase:**

- Guessing subscription limits, scraping ChatGPT, or converting tokens into undocumented subscription credits.
- Mixing reported ratios with local estimates in one number.

**Exit gate:** Window boundaries and reset anchors evaluate correctly in tests; missing measurements display "unknown," never zero; stale manual observations are visibly stale.

### Phase 4 — Quota card polish and history

**Scope:** Make the quota view pleasant for daily use.

**Deliverables:** Snapshot history per window (sparkline of utilization over the window), modest polling while the page is open, next-reset countdowns, local threshold indicators (e.g. card turns amber at 80%), and compact multi-account overview.

**NOT in this phase:** Background daemons, external notification services, hosted sync, or automatic plan changes.

**Exit gate:** Polling respects provider rate limits and stops when the tab is hidden; history does not duplicate snapshots across refreshes.

### Phase 5 — Notifications (only if needed)

**Scope:** Add alerts only after actual use shows the in-app indicators are insufficient.

**Deliverables:** Local desktop notifications for configurable thresholds and upcoming resets; no external services.

**NOT in this phase:** Email/SMS/push services, hosted infrastructure, or predictive billing.

## 1b. Side track — API-usage monitoring (deferred, not the priority)

Built in PR #1 and kept as-is: OpenAI and Anthropic Admin-API adapters (`lib/providers/`), the usage dashboard, tests, `/api/usage`, `/api/providers`, and the `/api/ingest` stub. Credentials for this track remain the env-configured org Admin keys. Work below resumes only when the main track no longer needs attention or a main-track phase needs it (e.g. Phase 3 derived measurements).

**Known pending work (in rough order):**

- **Cost parser fixes** before enabling costs anywhere (details in Section 2): OpenAI `amount.value` is already in its currency (do not divide by 100); Anthropic `amount` is a decimal string in cents with a separate `currency`. Both cost endpoints are daily-only; isolate cost failures from token usage.
- **Costs in the dashboard** and USD budgets, once parsers are fixed and verified against the consoles.
- **Persistence:** store provider buckets, ingested events, and fetch coverage in the same SQLite database as the main track; replace refreshed aggregate buckets instead of summing snapshots.
- **Ingest:** stable source/event IDs, durable idempotent ingestion, stricter validation, and authentication before accepting external writers. Moonshot token history via user-supplied capture scripts.
- **Multi-key/multi-connection:** named connections with org/project/workspace filters; keys sharing one account must not duplicate totals.
- **Extras:** CSV export, model filters, custom date ranges — only if actually used.

**NOT on this track:** Treating API usage as subscription consumption, a universal model-pricing engine, or an inference gateway/request proxy.

## 2. Architecture assessment

The existing [UsageProvider interface](/home/lucar/dev/personal/omni-ai-watch/lib/providers/types.ts) is a good boundary for **historical token and cost reports**. Keep its normalized buckets and vendor-specific adapters.

Its present limitations are mandatory `fetchUsage`, environment-dependent provider identity, one configuration per provider, and the assumption that every signal is a time-bucketed report.

### Dashboard data flow

Use a small client dashboard with TanStack Query:

`Client dashboard → local route handler → server-only provider adapter`

Keep `app/page.tsx` as the page shell. Reuse Base UI shadcn components from `@/components/ui/*` and the existing chart wrapper with recharts. No additional UI or fetching library is needed.

Use query keys containing provider/source, range, resolution, and cost inclusion. Keep range timestamps stable until refresh so changing `now` does not continuously create new queries. The existing 60-second `staleTime` is sufficient initially.

If server-side prefetching becomes useful later, call the shared service directly from the Server Component. The installed Next.js guide specifically advises against Server Components fetching their own route handlers.

### Minimal changes by phase

| Phase | Architectural change |
|---|---|
| Main 1 | Make historical `fetchUsage` optional; add optional `fetchQuotaSnapshot`. Add an OAuth callback route, a server-only token store module, and `/api/quotas`. Keep the existing API-usage registry untouched. |
| Main 2 | Move credentials to SQLite + OS keyring; introduce connection instances that resolve to server-side credentials. Add optional `fetchBalance` and capability metadata. |
| Main 3 | Add pure window/evaluation functions in `lib/quotas/` plus storage for quota definitions and manual observations. |
| Main 4–5 | Store snapshot history; add client polling/threshold logic only. |
| Side track | Fix cost parsers; extract a usage service shared by route handlers and quota evaluation; add bucket/event tables to the same SQLite database. |

Keep balance snapshots separate from `CostBucket`: a balance is an account state, not spending during an interval. Preserve its native currency. Likewise, a reported quota ratio is not a token bucket.

### Corrections identified in the current adapters

- **Fixed in PR #1: Anthropic input tokens.** Its report returns `uncached_input_tokens`, `cache_read_input_tokens`, and nested `cache_creation` counts. The current adapter reads `input_tokens`, so input totals can incorrectly become zero. Normalize `inputTokens` as uncached + cache reads + cache writes. [Anthropic usage schema](https://platform.claude.com/docs/en/api/beta/organization/usage_report/retrieve_messages)
- **Fixed in PR #1: cache semantics.** Define `inputTokens` as inclusive of cached input; `cachedInputTokens` is a subset and must not be added again. This matches OpenAI’s documented total. [Official OpenAI documentation](https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/completions)
- **Side track, pending: OpenAI costs.** `amount.value` is already expressed in its declared currency. Dividing USD values by 100 understates costs. Its cost endpoint supports daily buckets only. [OpenAI cost schema](https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/costs)
- **Side track, pending: Anthropic costs.** `amount` is a decimal string in cents, with a separate `currency`; it is not an `{ value, currency }` object. The current parser can therefore return zero. Costs are daily only. [Anthropic cost schema](https://platform.claude.com/docs/en/api/beta/organization/cost_report/retrieve), [reporting guide](https://platform.claude.com/docs/en/manage-claude/usage-cost-api)

For persistence, record account scope, interval, resolution, dimensions, source, and fetch time. Replace refreshed aggregate buckets rather than adding snapshots together. Store events separately and deduplicate by source/event ID. Do not sum report buckets and captured events covering the same activity; select an authoritative source for each metric and interval.

## 3. Kimi/Moonshot findings

**Kimi is feasible, but its API platform and subscription product need separate connectors.** Moonshot’s API platform uses pay-as-you-go billing and is distinct from Kimi Membership/Kimi Code. [Official product comparison](https://platform.kimi.ai/docs/guide/product-plans)

| Signal | Endpoint and authentication | Finding |
|---|---|---|
| Moonshot API balance | `GET https://api.moonshot.ai/v1/users/me/balance`; `Authorization: Bearer <Moonshot API key>` | Official. Returns available, voucher, and cash balances in USD. [Balance documentation](https://platform.kimi.ai/docs/api/balance) |
| Mainland API balance | Same path on `api.moonshot.cn`, using that platform’s API key | Official. Amounts are CNY; preserve currency separately from USD costs. [Mainland documentation](https://platform.kimi.com/docs/api/balance) |
| Per-request tokens | `POST /v1/chat/completions`, authenticated with the platform API key | Official responses include prompt/completion token counts and cache details. This observes requests made through the capturing client; it does not retrieve account history. [Chat API](https://platform.kimi.ai/docs/api/chat) |
| Historical API usage/billing | No documented reporting endpoint found | The reviewed reference lists balance and inference endpoints; the help center directs historical usage lookup to the console. [Reference index](https://platform.kimi.ai/docs/llms.txt), [usage lookup](https://www.kimi.com/en/help/kimi-api/api-balance-and-usage) |

**Subscription quotas are an exception to the original assumption.** Kimi Code documents `GET /api/v1/oauth/usage` on the local server started by `kimi web`, normally at `127.0.0.1:58627`. Authenticate with the local server’s bearer token; its managed account must already be logged in. It reports optional 5-hour, weekly, and monthly usage ratios/reset timestamps, plus wallet information. The API is explicitly experimental; use the running version’s authenticated `/openapi.json` as the contract. [Local server API](https://www.kimi.com/code/docs/en/kimi-code-cli/reference/server-api.html)

The official client source also calls `/usages` under `https://api.kimi.com/coding/v1`, with a global base at `https://api.kimi.ai/coding/v1`, using a bearer access token. This is a vendor-client endpoint visible in source, without an established stable public reporting contract. API-key access was not verified here. [Official client source](https://github.com/MoonshotAI/kimi-code/blob/main/packages/oauth/src/managed-usage.ts)

**Recommendation (updated 2026-10-01):** Add official Moonshot balance support in main-track Phase 2 — it is remote and official. **Kimi subscription quotas are ON HOLD**: the only quota-reporting surfaces are the experimental *local* `kimi web` server API (rejected — no local components) and the undocumented hosted `/usages` endpoint (rejected — no official contract); revisit only if Moonshot ships an official remote API. Captured token history through `/api/ingest` belongs to the side track (persistence/ingest); today that route acknowledges events but stores nothing.

## 4. Quota model proposal

Separate **definitions** from **observations**. User configuration describes the target and window; observed data determines whether progress can be calculated.

Start with a versioned JSON configuration:

| Field | Meaning |
|---|---|
| `id`, `label`, `enabled` | Stable identity and display settings. |
| `scope` | Provider/source initially; plan or shared account scope later. Optional model/dimension filters. |
| `metric` | Input, output, or total tokens; requests; credits; USD cost; or provider-reported ratio. |
| `limit` | Positive target in the metric’s units. Optional for ratio-only provider observations. |
| `window` | One of the definitions below. |
| `measurement` | Bucket-derived, provider-reported, or manual; identify the selected source. |

Only enable metrics with real measurements. Missing request counts or credits must remain unknown; bucket count is not request count.

| Window | Definition and calculation |
|---|---|
| Rolling | Duration, e.g. **300 minutes**. Evaluate `[now − duration, now)`. Any rolling duration uses the same model. |
| Weekly | Calendar week with explicit weekday/reset time/timezone, or a recurring seven-day period anchored to a subscription timestamp. |
| Monthly | Calendar month or billing month anchored to a configured day/time/timezone. Clamp unavailable billing days to month-end. |
| Total | Accumulate from an explicit starting timestamp, optionally to an ending timestamp; no recurring reset. |
| Budget | A cost metric attached to any window. Initially support reliable daily, weekly, monthly, and total USD budgets. |

Examples: “500,000 tokens in rolling 5h,” “2 million tokens per subscription week,” “$30 per billing month,” and “$100 since project start.” These are configured tracking targets unless a provider explicitly reports the corresponding plan quota.

Each evaluated observation should include usage or ratio, measurement time, actual window, reset/expiry information, source, coverage, and precision.

**Mapping observations into visualization:**

1. Resolve the quota’s entire window and scope, then fetch matching usage—not merely the dashboard’s seven-day series.
2. Use minute buckets for short rolling windows and coarser buckets where boundaries permit.
3. Sum fully contained buckets. For boundary-straddling buckets, request finer data or show an estimate/range; do not silently prorate counts.
4. Display `used / limit`, remaining amount, and overage. Cap only the drawn bar at 100%; retain the actual percentage.
5. Rolling usage recovers as events age out. Show the next known expiry rather than inventing a fixed full-reset time.
6. Display provider ratios directly, preserving their reported reset time. Do not translate them into tokens or combine them with locally derived estimates.
7. Keep missing history, delayed reports, and unavailable metrics visible. Daily cost reports cannot establish precise five-hour spending.

Quota definitions are introduced in main-track Phase 3 and stored server-side alongside connections. Total/lifetime accuracy still requires complete history or an explicit manual opening observation.

## 5. Risks and open questions

- **API versus subscription usage — resolved by re-prioritization.** Existing adapters measure organization API activity, not Claude Pro/Max or ChatGPT subscription consumption. The main track now targets subscriptions; API usage is the deferred side track.
- **Anthropic's quota endpoint is undocumented.** It is used by first-party clients but has no public contract. Keep it behind one adapter, validate responses at runtime, and fail to an explicit "unavailable" state if the shape changes.
- **OpenAI/ChatGPT exposes no plan-quota API.** ChatGPT quotas can only be user-defined with manual observations (main-track Phase 3).
- **Phase 1 needs a Claude Pro/Max account and a working OAuth flow.** If the OAuth flow or `org:admin` scope is unavailable to third-party apps, Phase 1 must change approach before more work is built on it.
- **Configured limits do not reveal consumption.** Subscription credits may depend on models, tools, and provider-specific accounting. A configured cap alone cannot produce truthful progress.
- **Kimi schemas and plans vary.** Current error documentation distinguishes weekly limits on legacy plans from newer plans. Render reported/configured windows rather than hardcoding a universal set. [Kimi quota rules](https://www.kimi.com/code/docs/en/kimi-code/error-reference.html)
- **Reporting is delayed and incomplete.** Distinguish fetched-at time from measurement coverage, and preserve refresh failures alongside previously successful data.
- **Timezone and billing anchors need explicit decisions.** Prefer provider-reported reset times; for user-defined quotas configure reset timezone, weekly anchor, monthly billing day, and month-end behavior.
- **Shared accounts create overlap.** Multiple keys can expose the same usage and quota pool. Attribution and deduplication must precede cross-plan totals.
- **Local runtime choices remain open.** Select a supported Node version/SQLite driver and OS keyring library in main-track Phase 2. Keep credentials server-side, use loopback by default, and add ingest authentication before accepting external writers.
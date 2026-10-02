# omni-ai-watch implementation roadmap

Research checked on **2026-10-01**. No files were modified. Provider credentials and live account responses were not tested.

## 1. Phased implementation plan

Implement one phase at a time. **Phase 1 is a useful stopping point**; later architecture should not become a prerequisite for displaying usage.

### Phase 1 — Basic local usage visualization

**Scope:** Display token usage from the existing OpenAI and Anthropic adapters, one provider at a time.

**Deliverables:**

- Replace the placeholder page with a provider selector, input/output/total token counts, and one daily stacked chart for the last seven days.
- Use `/api/providers` and `/api/usage` with `bucket_width=1d&costs=false`.
- Show loading, empty, missing-credentials, and fetch-error states, plus last successful refresh. Mark the current day as partial.
- Correct Anthropic token normalization before displaying totals; define consistent cache semantics as described in Section 2.
- Document env setup and local startup with `pnpm dev --hostname 127.0.0.1`.

**NOT in this phase:**

- Costs, quotas, Kimi integration, persistence, or ingest visualization.
- Custom date pickers, model filters, settings screens, background polling, or multi-plan support.

**Exit gate:** At least one real configured provider displays totals that agree with its console for the same reporting interval. Verify normalization and pagination with focused fixtures; run lint, typecheck, and build during implementation.

### Phase 2 — Provider expansion, including Kimi where supported

**Scope:** Complete coverage of the selected providers without pretending they expose equivalent data.

**Deliverables:**

- Validate both existing adapters against current vendor schemas and pagination.
- Add capability metadata: historical token usage, costs, balance, reported quotas, and supported resolutions.
- Add a `fetchQuotaSnapshot` capability for provider-reported subscription windows (5h rolling, weekly, …) — the original product goal. First implementation: Anthropic via OAuth login (Claude Code-style token, `org:admin` scope), which reports Pro/Max subscription utilization and reset times. Store tokens in the server-side credential store (per the security review); the browser holds only a session cookie.
- Add Moonshot's official balance connector (`api.moonshot.ai/v1/users/me/balance`) — remote, official, no local components.
- Show unsupported history explicitly. Keep one source selectable at a time.

**NOT in this phase:**

- A quota calculation engine or durable manual ingest.
- Private-console scraping, a request proxy, or further providers.
- **Kimi subscription quotas: ON HOLD.** The only quota-reporting surfaces are the experimental local `kimi web` server API (rejected — must not depend on a local component) and the undocumented hosted `/usages` endpoint (rejected — no official contract). Revisit only if Moonshot publishes an official remote API; until then Kimi shows balance only.

**Exit gate:** Every enabled connector returns a supported signal, and unsupported operations produce an explicit unavailable state.

### Phase 3 — Quota and budget visualization

**Scope:** Display provider-reported subscription windows and user-defined limits across rolling, weekly, monthly, and total windows.

**Deliverables:**

- A gitignored `config/quotas.local.json`, a committed example, and lightweight runtime validation.
- A quota evaluator and `/api/quotas` endpoint that fetch the full required window independently of the dashboard’s selected range.
- Progress cards showing used, remaining, percentage, reset/expiry information, measurement source, and incomplete coverage.
- Render Anthropic's reported subscription ratios directly (OAuth connector from Phase 2), preserving provider reset times; never translate them into tokens or mix with local estimates.
- Enable USD budgets after correcting the existing cost adapters. Query reported costs at daily resolution and isolate cost failures from token usage.
- Permit explicit manual observations when subscription consumption is otherwise unavailable.

**NOT in this phase:**

- Usage persistence, a configuration editor, forecasting, notifications, or quota enforcement.
- Automatic discovery of subscription limits or conversion of tokens into undocumented subscription credits.

**Exit gate:** Window boundaries, cache counting, partial buckets, and missing measurements behave correctly. Unsupported measurements display “unknown,” rather than zero.

### Phase 4 — Persistence and data model

**Scope:** Preserve history locally and make `/api/ingest` useful.

**Deliverables:**

- One local SQLite database, a small storage module, and versioned migrations; no ORM required.
- Store provider buckets, ingested events, quota/balance snapshots, and fetch coverage.
- Add stable source IDs and event IDs; make ingestion durable and idempotent.
- Tighten ingest validation, including malformed event objects and cached-token values.
- Let dashboard and quota queries use stored observations, with explicit refresh and stale-data status.
- Support Moonshot token history through user-supplied scripts or hooks that capture actual request usage.

**NOT in this phase:**

- Multi-plan management, cloud sync, a background daemon, or a universal request interception layer.
- Reconstructing individual requests from aggregate provider buckets.

**Exit gate:** Data survives restart; repeated ingestion and refreshes do not inflate totals; stored history remains viewable without provider access.

### Phase 5 — Multi-plan and multi-key

**Scope:** Separate providers, credential connections, accounts, and plans.

**Deliverables:**

- Named connections referencing env variables, with organization/project/workspace/key filters where available.
- Named plans and explicit shared quota scopes.
- Plan/source selection and comparisons.
- Preserve supported attribution dimensions in normalized buckets.
- Migrate each existing provider configuration into a default connection.

**NOT in this phase:**

- Team accounts, RBAC, credential synchronization, or automatic plan discovery.
- Treating each API key as an independent subscription quota.

**Exit gate:** Two connections to the same account do not duplicate organization totals; keys sharing one subscription also share its quota pool.

### Phase 6 — Optional convenience features

**Scope:** Add individual features only after actual use demonstrates a need.

**Deliverables:** Consider local configuration editing, CSV export, backup/restore, modest polling while the dashboard is open, and local threshold indicators.

**NOT in this phase:**

- Hosted SaaS, external notification services, predictive billing, or broad observability infrastructure.
- An inference gateway, browser-cookie scraping, or automatic purchasing/plan changes.

Defer additional usage modalities and providers until the user actually uses them. Keep a universal model-pricing engine outside this roadmap; prefer vendor-reported costs.

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
| 1 | Keep existing endpoints and registry. Add dashboard aggregation helpers and correct token normalization. |
| 2 | Make historical `fetchUsage` optional; add optional `fetchBalance` and `fetchQuotaSnapshot`. Expose capabilities and reject unsupported usage requests explicitly. Add a small status endpoint for snapshots. Mark credential requirements as required or optional. |
| 3 | Add pure window/aggregation functions in `lib/quotas/`. Read local configuration on the server. Extract a small usage service shared by route handlers and quota evaluation. |
| 4 | Insert SQLite reads/writes in that service. Providers remain responsible only for fetching and normalization. TanStack Query remains the browser cache. |
| 5 | Move configuration checks to connection instances. Resolve source IDs into server-side credentials and filters; retain provider implementations as reusable adapters. |
| 6 | Extend local configuration/storage services only for selected convenience features. |

Keep balance snapshots separate from `CostBucket`: a balance is an account state, not spending during an interval. Preserve its native currency. Likewise, a reported quota ratio is not a token bucket.

### Corrections identified in the current adapters

- **Phase 1: Anthropic input tokens.** Its report returns `uncached_input_tokens`, `cache_read_input_tokens`, and nested `cache_creation` counts. The current adapter reads `input_tokens`, so input totals can incorrectly become zero. Normalize `inputTokens` as uncached + cache reads + cache writes. [Anthropic usage schema](https://platform.claude.com/docs/en/api/beta/organization/usage_report/retrieve_messages)
- **Phase 1: cache semantics.** Define `inputTokens` as inclusive of cached input; `cachedInputTokens` is a subset and must not be added again. This matches OpenAI’s documented total. [Official OpenAI documentation](https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/completions)
- **Phase 3: OpenAI costs.** `amount.value` is already expressed in its declared currency. Dividing USD values by 100 understates costs. Its cost endpoint supports daily buckets only. [OpenAI cost schema](https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/costs)
- **Phase 3: Anthropic costs.** `amount` is a decimal string in cents, with a separate `currency`; it is not an `{ value, currency }` object. The current parser can therefore return zero. Costs are daily only. [Anthropic cost schema](https://platform.claude.com/docs/en/api/beta/organization/cost_report/retrieve), [reporting guide](https://platform.claude.com/docs/en/manage-claude/usage-cost-api)

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

**Recommendation (updated 2026-10-01):** Add official Moonshot balance support in Phase 2 — it is remote and official. **Kimi subscription quotas are ON HOLD**: the only quota-reporting surfaces are the experimental *local* `kimi web` server API (rejected — no local components) and the undocumented hosted `/usages` endpoint (rejected — no official contract); revisit only if Moonshot ships an official remote API. Add captured token history through `/api/ingest` in Phase 4; today that route acknowledges events but stores nothing.

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

Quota settings can live in a local file before Phase 4. Total/lifetime accuracy still requires complete history or an explicit manual opening observation.

## 5. Risks and open questions

- **API versus subscription usage is the main scope risk.** Existing adapters measure organization API activity. They do not establish Claude Pro/Max or ChatGPT subscription consumption. Confirm which product the user actually wants for each provider before implementing additional collectors.
- **Phase 1 needs usable credentials and activity.** If neither existing provider is accessible, the initial collection path must change; a blank dashboard is not a useful milestone.
- **Configured limits do not reveal consumption.** Subscription credits may depend on models, tools, and provider-specific accounting. A configured cap alone cannot produce truthful progress.
- **Kimi schemas and plans vary.** Current error documentation distinguishes weekly limits on legacy plans from newer plans. Render reported/configured windows rather than hardcoding a universal set. [Kimi quota rules](https://www.kimi.com/code/docs/en/kimi-code/error-reference.html)
- **Reporting is delayed and incomplete.** Distinguish fetched-at time from measurement coverage, and preserve refresh failures alongside previously successful data.
- **Timezone and billing anchors need explicit decisions.** Use UTC for Phase 1; later configure reset timezone, weekly anchor, monthly billing day, and month-end behavior.
- **Shared accounts create overlap.** Multiple keys can expose the same usage and quota pool. Attribution and deduplication must precede cross-plan totals.
- **Local runtime choices remain open.** Select a supported Node version/SQLite driver in Phase 4. Keep credentials server-side, use loopback by default, and add ingest authentication before accepting external writers.
# omni-watch roadmap

Decision date: **2026-10-01**. Implementation plan for the empty, renamed `brasillero/omni-watch` repository, governed by [ARCHITECTURE.md](ARCHITECTURE.md). This PR creates docs only; the phases below describe later implementation work.

The target is **provider-reported subscription quota windows**, acquired locally without handling credentials. Today's live evidence validates Claude statusline/headless usage and Codex rollout quota payloads; do not repeat the archived app-owned OAuth plan or API-spend side track. Kimi is out. Never restore archived application files or adopt untracked build/env leftovers as scaffolding.

Implement one phase at a time. **Phase 1 is a useful stopping point; Phase 3 is the complete v1 TUI release gate.** Browser work is a later optional milestone; Phase 5+ consists of speculative, independent horizons, not promises. Every phase must preserve unknown-versus-zero, last-observed timestamps, per-window replacement, no credential access, and no conversation-content persistence from its first slice.

## Phase 0 — Scaffold and boundaries

**Scope:** Establish the smallest buildable workspace and CI, with no provider collection.

**Deliverables:**

- Private pnpm workspace containing `packages/core`, `packages/local`, and `packages/tui`; package names and `omni-watch` binary contract follow ADR 005. Do not create future web/desktop packages.
- Node 24 LTS baseline, pinned pnpm/tools, lockfile, ESM/strict TypeScript builds and declarations. Core has no ambient Node/DOM types; restricted-import lint rules enforce dependency direction.
- Root format/lint, typecheck, focused-test, and build scripts; GitHub Actions uses frozen install. Repository ignore rules exclude local config, provider data, cache, credentials, and generated artifacts.
- Minimal CLI help and composition shell, core model/plugin/store/clock contracts, and an in-memory store for later semantic tests. Developer README describes build/run and local-only scope. No raw provider data fixtures.

**NOT in this phase:**

- Provider reads, statusline configuration changes, credential/env import, a daemon, SQLite, UI frameworks, browser/Electron scaffolds, or package publication.
- Restoring the old Next.js application or its organization API connectors.

**Exit gate:** A fresh clone installs, builds, and runs CLI help on Node 24 with all CI checks passing. Core package import performs no I/O, and forbidden UI/OS dependency edges are rejected. The package tarball's future name can be checked without publishing it.

## Phase 1 — Claude-only vertical slice

**Scope:** One default Claude account: documented statusline receiver → sanitized JSON store → one TUI provider card.

**Deliverables:**

- `omni-watch receive claude` accepts stdin, validates optional five-hour/seven-day windows, converts epoch seconds once, writes only allowlisted fields, prints a compact statusline, and exits. It works while the TUI is closed and imports no terminal renderer.
- JSON `SnapshotStore` with schema version, private file permissions, bounded cross-process locking, atomic replacement, per-window observed timestamps, and safe last-good retention.
- `omni-watch` renders reported windows with `log-update`/`readline`, percentages, resets, feed/source, and **last observed** age. Include the basic awaiting/missing/stale/reset-passed states now; a passed reset never changes usage to zero. `q` exits; `r` rereads cache; terminal resize/quit restore terminal state.
- Manual Claude setup instructions with an absolute executable path and an explicit existing-statusline composition example. No automatic settings overwrite. Explain that assistant activity supplies observations and cache rereads cannot force upstream refresh.
- Focused synthetic tests for allowlisting, seconds-to-milliseconds conversion, optional windows, duplicate/older observations, and concurrent receiver writes. Record a local timing check against the 300 ms debounce budget.

**NOT in this phase:**

- Codex, transcript/token history, headless `/usage` automation, balance, account switching, notifications, or browser UI.
- Token-to-quota conversion, inferred reset cycles, plan prices, or remote calls made by omni-watch.

**Exit gate:** With the user's normal Claude login, a new assistant response produces a sanitized cache update and matching TUI percentage/reset values. Use today's validated `claude -p "/usage"` only as a manual comparator when observations are close in time. The receiver works with the TUI closed; missing optional fields and a crossed reset show truthful states. A killed/competing receiver cannot corrupt the prior cache; synthetic canary prompt/secret fields never reach storage or output. CI passes.

## Phase 2 — Codex rollout plugin

**Scope:** Add passive Codex quota snapshots beside Claude using the same core and renderer.

**Deliverables:**

- Explicit built-in registry with working `planQuotaSnapshots` capabilities; dormant `usageHistory`/`balance` contracts remain unadvertised.
- Bounded rollout discovery under the configured Codex sessions root, complete-line JSONL parsing, append tailing, and periodic reconciliation. Select records by event timestamp; rescanning never makes old observations recent.
- Parse `event_msg` → `payload.type: token_count` → **`payload.rate_limits`**, a sibling of `info`. Normalize primary/secondary percentages, durations, epoch-second resets, meter ID, and optional plan type. Ignore token totals and credits.
- Reuse last-good/window identity semantics: multiple session snapshots replace the same account window, never add their percentages. Show CLI/feed availability and schema/read failures independently per provider.
- Single-account scope instructions, including an explicit local rebinding/cache reset and collection-start boundary when switching provider accounts. Expose that v1 cannot automatically establish account identity from historical files.
- Focused fixtures for the validated payload shape, missing/null quotas, multiple sessions, out-of-order timestamps, partial lines, and appended/new files; verify no raw conversation records are persisted.

**NOT in this phase:**

- App-server RPC, direct endpoint polling, token-history charts, credits/balance UI, provider login, multi-account discovery, or Kimi.

**Exit gate:** A real Codex quota event updates the second provider card and agrees with the CLI reading for the same account/time. Two sessions reporting 42% still display one 42% window. Restarting/rescanning retains the original event age. Claude continues updating during Codex feed errors, and a bounded scan reports incomplete discovery rather than pretending to have a complete account view. CI passes.

## Phase 3 — Robustness and v1 release

**Scope:** Harden the two-provider TUI and provide a stable headless inspection surface.

**Deliverables:**

- Complete freshness/reset/clock semantics and independent feed health from the architecture; configurable 15-minute default stale threshold, safe last-good preservation on refresh failure, unknown reset handling, and deterministic feed precedence.
- `omni-watch show` for one-shot text and **`omni-watch show --json`** for versioned sanitized snapshots/view state. Define exit codes; stdout stays machine-readable and safe diagnostics go to stderr. Non-TTY execution uses one-shot output without ANSI or raw mode.
- Watcher-loss recovery, truncation/rotation handling, source disappearance, cancelled reads, dead-owner lock recovery, corrupted-cache reporting, migration/refusal of unknown newer schemas, temporary-file cleanup, and clean signal shutdown.
- Narrow-terminal, ASCII/no-color, and terminal cleanup checks. Document collection lifetime, account-scope assumptions, offline/cache behavior, decoder revisions, and supported tested CLI versions.
- Meaningful automated gates: fake-clock boundary cases (including exact reset/stale instants), store-adapter conformance, concurrency/cancellation, schema-drift fixtures, content-leak canaries, and subprocess smoke tests for receiver/JSON/non-TTY paths. Keep live-account checks manual and outside CI.

**NOT in this phase:**

- Forecasting, notifications, retained utilization history, SQLite migration without a demonstrated need, a background service, web UI, RPC querying, or external plugins.

**Exit gate:** A documented clean install runs both providers, survives inactive/missing feeds and restart, and never changes cached age or infers a reset value. JSON output is stable, versioned, escape-free, and matches TUI semantics. Repeated ingestion does not inflate or regress readings; raw canaries are absent from cache/stdout/stderr. Focused tests, lint/typecheck/build, and manual TUI/feed checks pass. This is the **v1 release candidate**, not automatic npm publication.

## Phase 4 — Optional local browser interface

**Scope:** Reuse the completed headless core and local adapters in a browser-accessible local process.

**Deliverables:**

- Add `packages/web` only now, with a small Node host composing the existing registry, store, clock, and service. Choose browser rendering/bundling tools here; do not restore the archived framework by default.
- Read-only, versioned snapshot API plus SSE updates/reconnect, and browser cards with the same age/reset/error semantics. File/process access stays in the host; the browser has no credential or provider-file access.
- Loopback-only binding, Host/Origin validation, same-origin serving, restrictive CORS behavior, bounded responses, and shutdown/collector cleanup. Continue using JSON storage unless actual history/contention justifies an adapter change.
- Tests compare projections across TUI/JSON/browser and exercise disconnect/reconnect and origin controls. Explain that a local browser view still depends on locally produced observations.

**NOT in this phase:**

- Hosting, LAN exposure, authentication/token handling, arbitrary ingest/file endpoints, account-management screens, desktop packaging, or a second domain/storage model.
- App-server/headless querying as a prerequisite for browser viewing.

**Exit gate:** TUI and browser show the same observations, sources, and reset/stale states from the same cache; neither renderer implements quota interpretation independently. Browser refresh cannot renew observation age. Non-loopback and cross-origin access are rejected; no provider files or secrets are exposed. CI and local browser smoke checks pass.

## Phase 5+ — Speculative, independent horizons

Each row is a separate future decision with its own gate. None is required for v1 or an unconditional commitment.

| Horizon | Scope / deliverables | NOT in this horizon | Exit gate before adoption |
|---|---|---|---|
| **Official local queries** | Opt-in Codex app-server stdio adapter with handshake, read-only rate-limit RPC, timeouts/cleanup, multi-bucket normalization, and existing CLI-managed authentication. Consider Claude headless querying separately, with a versioned structured decoder. | Credential/token access, app-owned login, inference, account mutations, human-text scraping, automatic polling by default. | Live response validation, schema fixtures, and proof that no credentials enter omni-watch; offline/query failures preserve passive last-good readings. |
| **Electron shell** | `packages/desktop`; reuse browser rendering and run core/local in main with narrow preload IPC. Add packaging/signing/update decisions only when requested. | Renderer Node access, new quota collectors, hosted service, mandatory HTTP server. | Demonstrated desktop need; sandboxed renderer and IPC/lifecycle tests; compatibility with supported Electron/Node runtime. |
| **Kimi** | Reevaluate a plugin only when an **official remote subscription-quota API** exists and fits the no-credential boundary, e.g. through provider-owned CLI mediation. | Experimental local bearer-token bridge, private hosted endpoints, Moonshot API balance as a quota substitute. | Official contract plus sanctioned credential-free acquisition and validated plan windows. Until then: out. |
| **Multi-account** | Explicit local profile bindings, independent scope IDs, collection boundaries, and declared shared-pool identity. | Credential discovery/switching, summing shared pools, treating sessions as accounts. | Two verified account scopes coexist; feeds for the same shared window produce one reading, not duplicated totals. |
| **History / SQLite** | Retain sanitized window observations only if daily use needs trends; replace storage behind the existing interface if volume/concurrency requires it. Optional local token history remains a separate capability. | API-spend or plan-cost tracking, transcript archive, quota estimates from token totals. | Measured storage/query need, bounded retention/migration design, and passing store conformance/deduplication/privacy tests. |

Permanent non-goals remain permanent across all horizons. New feed revisions require their own fixtures and policy-compatible acquisition; a new UI is never a reason to add credential handling.

import {
  type CostBucket,
  type ProviderConfig,
  ProviderError,
  type UsageBucket,
  type UsageProvider,
  type UsageQuery,
} from "./types"

const API_BASE = "https://api.anthropic.com/v1"
const ANTHROPIC_VERSION = "2023-06-01"

interface AnthropicUsageResult {
  uncached_input_tokens?: number
  cache_read_input_tokens?: number
  cache_creation?: {
    ephemeral_5m_input_tokens?: number
    ephemeral_1h_input_tokens?: number
  }
  output_tokens?: number
  model?: string
  workspace_id?: string | null
}

interface AnthropicCostResult {
  amount?: { value?: string; currency?: string }
  description?: string
  workspace_id?: string | null
}

interface AnthropicReportResponse<T> {
  data?: T[]
  has_more?: boolean
  next_page?: string | null
}

function buildHeaders(config: ProviderConfig): HeadersInit {
  const headers: Record<string, string> = {
    "x-api-key": config.apiKey,
    "anthropic-version": ANTHROPIC_VERSION,
    "User-Agent": "omni-ai-watch/0.1",
    "Content-Type": "application/json",
  }
  if (config.organizationId) {
    headers["anthropic-organization-id"] = config.organizationId
  }
  return headers
}

async function fetchReport<T>(
  path: string,
  config: ProviderConfig,
  query: UsageQuery,
): Promise<T[]> {
  const rows: T[] = []
  let page: string | null = null

  do {
    const params = new URLSearchParams({
      starting_at: query.start.toISOString(),
      ending_at: query.end.toISOString(),
    })
    for (const group of query.groupBy ?? ["model"]) {
      params.append("group_by[]", group)
    }
    if (path.includes("usage_report")) {
      params.set("bucket_width", query.bucketWidth ?? "1d")
    }
    if (page) params.set("page", page)

    let res: Response
    try {
      res = await fetch(`${API_BASE}${path}?${params}`, {
        headers: buildHeaders(config),
      })
    } catch (error) {
      throw new ProviderError(
        "anthropic",
        `Anthropic ${path} request failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new ProviderError(
        "anthropic",
        `Anthropic ${path} failed: ${res.status} ${body.slice(0, 300)}`,
        res.status,
      )
    }

    let json: AnthropicReportResponse<T>
    try {
      json = (await res.json()) as AnthropicReportResponse<T>
    } catch {
      throw new ProviderError(
        "anthropic",
        `Anthropic ${path} returned a non-JSON body (status ${res.status})`,
        res.status,
      )
    }
    rows.push(...(json.data ?? []))
    page = json.has_more ? (json.next_page ?? null) : null
  } while (page)

  return rows
}

export const anthropicProvider: UsageProvider = {
  id: "anthropic",
  name: "Anthropic",
  website: "https://anthropic.com",
  credentials: [
    {
      env: "ANTHROPIC_ADMIN_API_KEY",
      kind: "Admin API key (sk-ant-admin01-...)",
      hint: "The Usage & Cost Admin API requires an organization Admin key; workspace keys do not work.",
    },
    {
      env: "ANTHROPIC_ORGANIZATION_ID",
      kind: "Organization id (org_...)",
      hint: "Optional — only needed if the key belongs to multiple organizations.",
    },
  ],
  isConfigured: () => Boolean(process.env.ANTHROPIC_ADMIN_API_KEY),

  async fetchUsage(config, query): Promise<UsageBucket[]> {
    const rows = await fetchReport<{
      starting_at?: string
      ending_at?: string
      results?: AnthropicUsageResult[]
    }>("/organizations/usage_report/messages", config, query)

    return rows.flatMap((row) =>
      (row.results ?? []).map((result) => {
        // Schema (2026-10): results carry `uncached_input_tokens`,
        // `cache_read_input_tokens` and `cache_creation.{ephemeral_5m, ephemeral_1h}`.
        // `inputTokens` is the inclusive total (uncached + cache reads + cache writes);
        // `cachedInputTokens` counts cache READS only (writes stay in the total).
        const cacheCreation =
          (result.cache_creation?.ephemeral_5m_input_tokens ?? 0) +
          (result.cache_creation?.ephemeral_1h_input_tokens ?? 0)
        return {
          start: row.starting_at ?? query.start.toISOString(),
          end: row.ending_at ?? query.end.toISOString(),
          model: result.model,
          inputTokens:
            (result.uncached_input_tokens ?? 0) +
            (result.cache_read_input_tokens ?? 0) +
            cacheCreation,
          outputTokens: result.output_tokens ?? 0,
          // Absent field means "unknown" — do not report a fabricated zero
          // (kept consistent with the OpenAI adapter).
          cachedInputTokens: result.cache_read_input_tokens,
          dimensions: {
            ...(result.workspace_id
              ? { workspace: result.workspace_id }
              : {}),
          },
        }
      }),
    )
  },

  async fetchCosts(config, query): Promise<CostBucket[]> {
    const rows = await fetchReport<{
      starting_at?: string
      ending_at?: string
      results?: AnthropicCostResult[]
    }>("/organizations/cost_report", config, {
      ...query,
      groupBy: query.groupBy ?? ["workspace_id", "description"],
    })

    return rows.flatMap((row) =>
      (row.results ?? []).map((result) => {
        // Amounts are decimal strings in lowest units (cents).
        const cents = Number(result.amount?.value ?? 0)
        return {
          start: row.starting_at ?? query.start.toISOString(),
          end: row.ending_at ?? query.end.toISOString(),
          costUsd: cents / 100,
          description: result.description,
          dimensions: {
            ...(result.workspace_id ? { workspace: result.workspace_id } : {}),
          },
        }
      }),
    )
  },
}

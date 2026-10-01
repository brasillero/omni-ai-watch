import {
  type CostBucket,
  type ProviderConfig,
  ProviderError,
  type UsageBucket,
  type UsageProvider,
  type UsageQuery,
} from "./types"

const API_BASE = "https://api.openai.com/v1"

interface OpenAiResult {
  input_tokens?: number
  input_cached_tokens?: number
  output_tokens?: number
  model?: string
  project_id?: string | null
}

interface OpenAiBucket {
  start_time?: number
  end_time?: number
  results?: OpenAiResult[]
}

interface OpenAiListResponse {
  data?: OpenAiBucket[]
  next_page?: string | null
  has_more?: boolean
}

async function fetchUsageEndpoint(
  path: string,
  config: ProviderConfig,
  query: UsageQuery,
): Promise<OpenAiListResponse> {
  const buckets: OpenAiBucket[] = []
  let page: string | null = null

  do {
    const params = new URLSearchParams({
      start_time: String(Math.floor(query.start.getTime() / 1000)),
      end_time: String(Math.floor(query.end.getTime() / 1000)),
      bucket_width: query.bucketWidth ?? "1d",
    })
    for (const group of query.groupBy ?? ["model"]) {
      params.append("group_by[]", group)
    }
    if (config.projectIds?.length) {
      for (const id of config.projectIds) params.append("project_ids[]", id)
    }
    if (page) params.set("page", page)

    const res = await fetch(`${API_BASE}${path}?${params}`, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new ProviderError(
        "openai",
        `OpenAI ${path} failed: ${res.status} ${body.slice(0, 300)}`,
        res.status,
      )
    }

    const json = (await res.json()) as OpenAiListResponse
    buckets.push(...(json.data ?? []))
    page = json.next_page ?? null
  } while (page)

  return { data: buckets }
}

export const openaiProvider: UsageProvider = {
  id: "openai",
  name: "OpenAI",
  website: "https://openai.com",
  credentials: [
    {
      env: "OPENAI_ADMIN_API_KEY",
      kind: "Admin API key (sk-admin-...)",
      hint: "Usage & cost endpoints require an organization Admin key, not a regular project key.",
    },
  ],
  isConfigured: () => Boolean(process.env.OPENAI_ADMIN_API_KEY),

  async fetchUsage(config, query): Promise<UsageBucket[]> {
    const { data } = await fetchUsageEndpoint(
      "/organization/usage/completions",
      config,
      query,
    )

    return (data ?? []).flatMap((bucket) =>
      (bucket.results ?? []).map((result) => ({
        start: new Date((bucket.start_time ?? 0) * 1000).toISOString(),
        end: new Date((bucket.end_time ?? 0) * 1000).toISOString(),
        model: result.model,
        inputTokens: result.input_tokens ?? 0,
        outputTokens: result.output_tokens ?? 0,
        cachedInputTokens: result.input_cached_tokens,
        dimensions: {
          ...(result.project_id ? { project: result.project_id } : {}),
        },
      })),
    )
  },

  async fetchCosts(config, query): Promise<CostBucket[]> {
    const { data } = await fetchUsageEndpoint(
      "/organization/costs",
      config,
      { ...query, groupBy: query.groupBy ?? ["line_item"] },
    )

    return (data ?? []).flatMap((bucket) =>
      (bucket.results ?? []).flatMap((result) => {
        const raw = result as unknown as {
          amount?: { value?: string; currency?: string }
          line_item?: string
          project_id?: string | null
        }
        const cents = Number(raw.amount?.value ?? 0)
        return [
          {
            start: new Date((bucket.start_time ?? 0) * 1000).toISOString(),
            end: new Date((bucket.end_time ?? 0) * 1000).toISOString(),
            costUsd: cents / 100,
            description: raw.line_item,
            dimensions: {
              ...(raw.project_id ? { project: raw.project_id } : {}),
            },
          },
        ]
      }),
    )
  },
}

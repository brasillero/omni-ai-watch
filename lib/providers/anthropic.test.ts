import { afterEach, describe, expect, it, vi } from "vitest"

import { anthropicProvider } from "./anthropic"
import type { ProviderConfig } from "./types"

const config: ProviderConfig = {
  apiKey: "sk-ant-admin01-test",
  organizationId: "org_test",
}

const query = {
  start: new Date("2026-09-01T00:00:00Z"),
  end: new Date("2026-09-03T00:00:00Z"),
  bucketWidth: "1d" as const,
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

const page1 = {
  data: [
    {
      starting_at: "2026-09-01T00:00:00Z",
      ending_at: "2026-09-02T00:00:00Z",
      results: [
        {
          uncached_input_tokens: 1000,
          cache_read_input_tokens: 200,
          cache_creation: {
            ephemeral_5m_input_tokens: 30,
            ephemeral_1h_input_tokens: 70,
          },
          output_tokens: 500,
          model: "claude-opus-5",
          workspace_id: "wrkspc_1",
        },
      ],
    },
  ],
  has_more: true,
  next_page: "page-2",
}

const page2 = {
  data: [
    {
      starting_at: "2026-09-02T00:00:00Z",
      ending_at: "2026-09-03T00:00:00Z",
      results: [
        {
          uncached_input_tokens: 400,
          cache_read_input_tokens: 0,
          cache_creation: {
            ephemeral_5m_input_tokens: 0,
            ephemeral_1h_input_tokens: 0,
          },
          output_tokens: 150,
          model: "claude-opus-5",
          workspace_id: null,
        },
      ],
    },
  ],
  has_more: false,
  next_page: null,
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("anthropicProvider.fetchUsage", () => {
  it("normalizes tokens across a 2-page report", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(page1))
      .mockResolvedValueOnce(jsonResponse(page2))
    vi.stubGlobal("fetch", fetchMock)

    const buckets = await anthropicProvider.fetchUsage(config, query)

    expect(buckets).toHaveLength(2)
    // inputTokens = uncached + cache reads + cache creation (inclusive total)
    expect(buckets[0].inputTokens).toBe(1000 + 200 + 30 + 70)
    // cachedInputTokens = cache READS only (writes excluded)
    expect(buckets[0].cachedInputTokens).toBe(200)
    expect(buckets[0].outputTokens).toBe(500)
    expect(buckets[0].model).toBe("claude-opus-5")
    expect(buckets[0].dimensions.workspace).toBe("wrkspc_1")

    expect(buckets[1].inputTokens).toBe(400)
    expect(buckets[1].cachedInputTokens).toBe(0)
    expect(buckets[1].dimensions.workspace).toBeUndefined()
  })

  it("paginates using next_page until has_more is false", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(page1))
      .mockResolvedValueOnce(jsonResponse(page2))
    vi.stubGlobal("fetch", fetchMock)

    await anthropicProvider.fetchUsage(config, query)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const firstUrl = String(fetchMock.mock.calls[0][0])
    const secondUrl = String(fetchMock.mock.calls[1][0])
    expect(firstUrl).toContain("bucket_width=1d")
    expect(firstUrl).not.toContain("page=")
    expect(secondUrl).toContain("page=page-2")
  })

  it("sends the organization header only when configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(page2))
    vi.stubGlobal("fetch", fetchMock)

    await anthropicProvider.fetchUsage(
      { apiKey: config.apiKey },
      query,
    )

    const headers = (fetchMock.mock.calls[0][1] as RequestInit)
      .headers as Record<string, string>
    expect(headers["anthropic-organization-id"]).toBeUndefined()
    expect(headers["x-api-key"]).toBe(config.apiKey)
    expect(headers["anthropic-version"]).toBe("2023-06-01")
  })

  it("wraps network failures in ProviderError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    )

    await expect(anthropicProvider.fetchUsage(config, query)).rejects.toMatchObject(
      { name: "ProviderError", providerId: "anthropic" },
    )
  })
})

import { afterEach, describe, expect, it, vi } from "vitest"

import { openaiProvider } from "./openai"
import type { ProviderConfig } from "./types"

const config: ProviderConfig = { apiKey: "sk-admin-test" }

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

const day1 = Math.floor(Date.UTC(2026, 8, 1) / 1000) // 2026-09-01T00:00:00Z
const day2 = Math.floor(Date.UTC(2026, 8, 2) / 1000)
const day3 = Math.floor(Date.UTC(2026, 8, 3) / 1000)

const page1 = {
  data: [
    {
      start_time: day1,
      end_time: day2,
      results: [
        {
          input_tokens: 1200,
          input_cached_tokens: 300,
          output_tokens: 600,
          model: "gpt-5",
          project_id: "proj_1",
        },
      ],
    },
  ],
  next_page: "page-2",
  has_more: true,
}

const page2 = {
  data: [
    {
      start_time: day2,
      end_time: day3,
      results: [
        {
          input_tokens: 800,
          input_cached_tokens: 0,
          output_tokens: 200,
          model: "gpt-5",
          project_id: null,
        },
      ],
    },
  ],
  next_page: null,
  has_more: false,
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("openaiProvider.fetchUsage", () => {
  it("normalizes tokens across a 2-page report", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(page1))
      .mockResolvedValueOnce(jsonResponse(page2))
    vi.stubGlobal("fetch", fetchMock)

    const buckets = await openaiProvider.fetchUsage(config, query)

    expect(buckets).toHaveLength(2)
    expect(buckets[0].inputTokens).toBe(1200)
    expect(buckets[0].cachedInputTokens).toBe(300)
    expect(buckets[0].outputTokens).toBe(600)
    expect(buckets[0].model).toBe("gpt-5")
    expect(buckets[0].dimensions.project).toBe("proj_1")
    expect(buckets[0].start).toBe("2026-09-01T00:00:00.000Z")

    expect(buckets[1].inputTokens).toBe(800)
    expect(buckets[1].dimensions.project).toBeUndefined()
  })

  it("paginates using next_page until exhausted", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(page1))
      .mockResolvedValueOnce(jsonResponse(page2))
    vi.stubGlobal("fetch", fetchMock)

    await openaiProvider.fetchUsage(config, query)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const firstUrl = String(fetchMock.mock.calls[0][0])
    const secondUrl = String(fetchMock.mock.calls[1][0])
    expect(firstUrl).toContain("/v1/organization/usage/completions")
    expect(firstUrl).toContain("bucket_width=1d")
    expect(firstUrl).toContain("group_by%5B%5D=model")
    expect(secondUrl).toContain("page=page-2")
  })

  it("maps vendor errors to ProviderError with the status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("Unauthorized", { status: 401 }),
      ),
    )

    await expect(
      openaiProvider.fetchUsage(config, query),
    ).rejects.toMatchObject({
      name: "ProviderError",
      providerId: "openai",
      status: 401,
    })
  })
})

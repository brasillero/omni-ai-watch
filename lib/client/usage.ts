import { useQuery } from "@tanstack/react-query"

import type { UsageBucket } from "@/lib/providers/types"

export interface ProviderCredentialInfo {
  env: string
  kind: string
  hint?: string
  present: boolean
}

export interface ProviderInfo {
  id: string
  name: string
  website: string
  configured: boolean
  supportsCosts: boolean
  credentials: ProviderCredentialInfo[]
}

export interface ProvidersResponse {
  providers: ProviderInfo[]
}

export interface UsageResponse {
  provider: string
  start: string
  end: string
  bucketWidth: string
  usage: UsageBucket[]
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed: ${res.status}`
    throw new ApiError(res.status, message, body)
  }
  return body as T
}

/** Retry only transient failures — API errors (4xx/503/502) are deterministic. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError) return false
  return failureCount < 2
}

export function useProviders() {
  return useQuery({
    queryKey: ["providers"],
    retry: shouldRetry,
    queryFn: async () =>
      parseJsonResponse<ProvidersResponse>(await fetch("/api/providers")),
  })
}

export interface UsageRange {
  start: Date
  end: Date
}

/** Last 7 calendar days (UTC), aligned to day boundaries. */
export function getDefaultRange(now = new Date()): UsageRange {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6),
  )
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  )
  return { start, end }
}

export function useUsage(providerId: string | undefined, range: UsageRange) {
  const start = range.start.toISOString()
  const end = range.end.toISOString()
  return useQuery({
    queryKey: ["usage", providerId, start, end],
    enabled: Boolean(providerId),
    retry: shouldRetry,
    // Loopback fetches: attempt even when the browser reports offline, so
    // connectivity problems surface as errors instead of silent pauses.
    networkMode: "always",
    queryFn: async () => {
      const params = new URLSearchParams({
        provider: providerId!,
        start,
        end,
        bucket_width: "1d",
        costs: "false",
      })
      return parseJsonResponse<UsageResponse>(
        await fetch(`/api/usage?${params}`),
      )
    },
  })
}

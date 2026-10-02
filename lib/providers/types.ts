/**
 * Core abstractions for AI usage providers.
 *
 * A provider pulls usage (tokens) and cost data from an AI vendor's API and
 * normalizes it into the shapes below, so the rest of the app never has to
 * know about vendor-specific response formats.
 */

export type BucketWidth = "1m" | "1h" | "1d"

export interface UsageQuery {
  start: Date
  end: Date
  bucketWidth?: BucketWidth
  groupBy?: string[]
}

/** Normalized token-usage bucket. */
export interface UsageBucket {
  /** ISO 8601 bucket start. */
  start: string
  /** ISO 8601 bucket end. */
  end: string
  model?: string
  /**
   * Total input tokens, INCLUSIVE of cached input (cache reads + cache
   * writes). `cachedInputTokens` is a subset of this value — never add the
   * two together.
   */
  inputTokens: number
  outputTokens: number
  /** Input tokens read from cache (subset of `inputTokens`; cache writes excluded). */
  cachedInputTokens?: number
  /** Vendor-specific extra dimensions (workspace, project, api key id, ...). */
  dimensions: Record<string, string>
}

/** Normalized cost bucket. Amounts are always USD. */
export interface CostBucket {
  start: string
  end: string
  costUsd: number
  description?: string
  dimensions: Record<string, string>
}

export interface ProviderConfig {
  apiKey: string
  /** Anthropic: organization id (sent as anthropic-organization-id). */
  organizationId?: string
  /** OpenAI: restrict to these project ids. */
  projectIds?: string[]
}

export interface CredentialRequirement {
  /** Environment variable that holds the secret. */
  env: string
  /** What kind of key it is (for display only, never the value). */
  kind: string
  hint?: string
}

export interface UsageProvider {
  /** Stable machine id, e.g. "openai". */
  id: string
  /** Human name, e.g. "OpenAI". */
  name: string
  website: string
  credentials: CredentialRequirement[]
  /** True when all required credentials are present in the environment. */
  isConfigured(): boolean
  fetchUsage(config: ProviderConfig, query: UsageQuery): Promise<UsageBucket[]>
  /** Optional: not every vendor exposes cost separately from usage. */
  fetchCosts?(config: ProviderConfig, query: UsageQuery): Promise<CostBucket[]>
}

export class ProviderError extends Error {
  constructor(
    public readonly providerId: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = "ProviderError"
  }
}

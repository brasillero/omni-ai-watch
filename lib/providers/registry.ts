import { anthropicProvider } from "./anthropic"
import { openaiProvider } from "./openai"
import type { ProviderConfig, UsageProvider } from "./types"

const registry = new Map<string, UsageProvider>(
  [openaiProvider, anthropicProvider].map((p) => [p.id, p]),
)

export function listProviders(): UsageProvider[] {
  return [...registry.values()]
}

export function getProvider(id: string): UsageProvider | undefined {
  return registry.get(id)
}

/**
 * Build a ProviderConfig for a registered provider from environment
 * variables. Per-plan credentials (multiple keys per provider) arrive with
 * the data model; for now a provider reads its key from the environment.
 */
export function configFromEnv(provider: UsageProvider): ProviderConfig | null {
  switch (provider.id) {
    case "openai": {
      const apiKey = process.env.OPENAI_ADMIN_API_KEY
      return apiKey ? { apiKey } : null
    }
    case "anthropic": {
      const apiKey = process.env.ANTHROPIC_ADMIN_API_KEY
      return apiKey
        ? { apiKey, organizationId: process.env.ANTHROPIC_ORGANIZATION_ID }
        : null
    }
    default:
      return null
  }
}

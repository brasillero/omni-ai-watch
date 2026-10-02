import { getProvider } from "@/lib/providers/registry"

/**
 * Generic usage-event webhook. Accepts events from proxies, CLI hooks or
 * custom scripts that observed an AI request, e.g.:
 *
 *   curl -X POST localhost:3000/api/ingest \
 *     -H 'Content-Type: application/json' \
 *     -d '{"provider":"openai","events":[{
 *           "timestamp":"2026-10-01T12:00:00Z",
 *           "model":"gpt-5",
 *           "inputTokens":1200,
 *           "outputTokens":300,
 *           "costUsd":0.012
 *         }]}'
 *
 * TODO(storage): persist validated events once the data model lands.
 * For now events are validated, normalized and acknowledged (202).
 */

interface RawUsageEvent {
  timestamp?: unknown
  model?: unknown
  inputTokens?: unknown
  outputTokens?: unknown
  cachedInputTokens?: unknown
  costUsd?: unknown
  dimensions?: unknown
}

interface NormalizedUsageEvent {
  timestamp: string
  provider?: string
  model?: string
  inputTokens: number
  outputTokens: number
  cachedInputTokens?: number
  costUsd?: number
  dimensions: Record<string, string>
}

function asDimensions(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null) return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  )
}

function normalizeEvent(
  raw: RawUsageEvent,
  provider: string | undefined,
): NormalizedUsageEvent | string {
  const timestamp = new Date(String(raw.timestamp ?? ""))
  if (Number.isNaN(timestamp.getTime())) return "timestamp must be a valid date"
  if (typeof raw.model !== "string" || !raw.model) return "model is required"
  const inputTokens = Number(raw.inputTokens)
  const outputTokens = Number(raw.outputTokens)
  if (!Number.isFinite(inputTokens) || inputTokens < 0)
    return "inputTokens must be a non-negative number"
  if (!Number.isFinite(outputTokens) || outputTokens < 0)
    return "outputTokens must be a non-negative number"

  const costUsd = raw.costUsd === undefined ? undefined : Number(raw.costUsd)
  if (costUsd !== undefined && (!Number.isFinite(costUsd) || costUsd < 0))
    return "costUsd must be a non-negative number"

  return {
    timestamp: timestamp.toISOString(),
    provider,
    model: raw.model,
    inputTokens,
    outputTokens,
    cachedInputTokens:
      raw.cachedInputTokens === undefined
        ? undefined
        : Number(raw.cachedInputTokens),
    costUsd,
    dimensions: asDimensions(raw.dimensions),
  }
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Request body must be valid JSON" }, { status: 400 })
  }

  const { provider, events } = (body ?? {}) as {
    provider?: unknown
    events?: unknown
  }

  if (provider !== undefined) {
    if (typeof provider !== "string" || !getProvider(provider)) {
      return Response.json(
        { error: `Unknown provider: ${String(provider)}` },
        { status: 400 },
      )
    }
  }

  const rawEvents = Array.isArray(events) ? events : events === undefined ? [body] : null
  if (!rawEvents || rawEvents.length === 0) {
    return Response.json(
      { error: "Body must contain an event or a non-empty events array" },
      { status: 400 },
    )
  }

  const normalized: NormalizedUsageEvent[] = []
  const errors: { index: number; error: string }[] = []
  rawEvents.forEach((raw, index) => {
    const result = normalizeEvent(raw as RawUsageEvent, provider as string | undefined)
    if (typeof result === "string") errors.push({ index, error: result })
    else normalized.push(result)
  })

  if (errors.length > 0) {
    return Response.json(
      { error: "Invalid events", details: errors, received: rawEvents.length },
      { status: 422 },
    )
  }

  // TODO(storage): write `normalized` to the store once the data model lands.
  return Response.json(
    { received: normalized.length, accepted: true, persisted: false },
    { status: 202 },
  )
}

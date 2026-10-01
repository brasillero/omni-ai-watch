import type { NextRequest } from "next/server"
import { configFromEnv, getProvider } from "@/lib/providers/registry"
import { ProviderError, type BucketWidth } from "@/lib/providers/types"

const BUCKET_WIDTHS: BucketWidth[] = ["1m", "1h", "1d"]

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const providerId = params.get("provider")
  const startParam = params.get("start")
  const endParam = params.get("end")
  const bucketWidth = (params.get("bucket_width") ?? "1d") as BucketWidth
  const includeCosts = params.get("costs") !== "false"

  if (!providerId) {
    return Response.json({ error: "Missing required query param: provider" }, { status: 400 })
  }
  if (!startParam || !endParam) {
    return Response.json(
      { error: "Missing required query params: start and end (ISO 8601)" },
      { status: 400 },
    )
  }
  if (!BUCKET_WIDTHS.includes(bucketWidth)) {
    return Response.json(
      { error: `bucket_width must be one of: ${BUCKET_WIDTHS.join(", ")}` },
      { status: 400 },
    )
  }

  const start = new Date(startParam)
  const end = new Date(endParam)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return Response.json({ error: "start/end must be valid ISO 8601 dates" }, { status: 400 })
  }
  if (start >= end) {
    return Response.json({ error: "start must be before end" }, { status: 400 })
  }

  const provider = getProvider(providerId)
  if (!provider) {
    return Response.json(
      { error: `Unknown provider: ${providerId}` },
      { status: 404 },
    )
  }

  const config = configFromEnv(provider)
  if (!config) {
    return Response.json(
      {
        error: `Provider ${providerId} is not configured`,
        missing: provider.credentials.map((c) => c.env),
      },
      { status: 503 },
    )
  }

  try {
    const usagePromise = provider.fetchUsage(config, { start, end, bucketWidth })
    const costsPromise =
      includeCosts && provider.fetchCosts
        ? provider.fetchCosts(config, { start, end, bucketWidth })
        : Promise.resolve(undefined)
    const [usage, costs] = await Promise.all([usagePromise, costsPromise])

    return Response.json({
      provider: provider.id,
      start: start.toISOString(),
      end: end.toISOString(),
      bucketWidth,
      usage,
      ...(costs ? { costs } : {}),
    })
  } catch (error) {
    if (error instanceof ProviderError) {
      return Response.json(
        { error: error.message, provider: error.providerId, status: error.status },
        { status: 502 },
      )
    }
    throw error
  }
}

import { listProviders } from "@/lib/providers/registry"

export function GET() {
  return Response.json({
    providers: listProviders().map((p) => ({
      id: p.id,
      name: p.name,
      website: p.website,
      configured: p.isConfigured(),
      supportsCosts: Boolean(p.fetchCosts),
      credentials: p.credentials.map((c) => ({
        ...c,
        present: Boolean(process.env[c.env]),
      })),
    })),
  })
}

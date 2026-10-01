"use client"

import { useState } from "react"
import { format } from "date-fns"
import { RefreshCw } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  ApiError,
  getDefaultRange,
  useProviders,
  useUsage,
  type ProviderInfo,
  type UsageRange,
} from "@/lib/client/usage"
import type { UsageBucket } from "@/lib/providers/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const numberFormat = new Intl.NumberFormat()

const chartConfig = {
  input: { label: "Input", color: "var(--color-chart-1)" },
  output: { label: "Output", color: "var(--color-chart-2)" },
} satisfies ChartConfig

function hasTokens(bucket: UsageBucket) {
  return bucket.inputTokens > 0 || bucket.outputTokens > 0
}

function toChartData(buckets: UsageBucket[], range: UsageRange) {
  const byDay = new Map<string, { input: number; output: number }>()
  for (const bucket of buckets) {
    const key = bucket.start.slice(0, 10)
    const day = byDay.get(key) ?? { input: 0, output: 0 }
    day.input += bucket.inputTokens
    day.output += bucket.outputTokens
    byDay.set(key, day)
  }

  const now = new Date()
  const todayStartMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  )
  const dayLabel = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })

  const days: { day: string; input: number; output: number }[] = []
  for (
    let d = new Date(range.start);
    d < range.end;
    d = new Date(d.getTime() + 86_400_000)
  ) {
    const key = d.toISOString().slice(0, 10)
    const usage = byDay.get(key) ?? { input: 0, output: 0 }
    days.push({
      day: dayLabel.format(d) + (d.getTime() >= todayStartMs ? "*" : ""),
      input: usage.input,
      output: usage.output,
    })
  }
  return days
}

export function Dashboard() {
  const [range] = useState(getDefaultRange)
  const providersQuery = useProviders()
  const providers = providersQuery.data?.providers ?? []

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected =
    providers.find((p) => p.id === selectedId) ??
    providers.find((p) => p.configured) ??
    providers[0]

  const usageQuery = useUsage(
    selected?.configured ? selected.id : undefined,
    range,
  )
  const buckets = usageQuery.data?.usage ?? []
  const activeBuckets = buckets.filter(hasTokens)

  const inputTotal = activeBuckets.reduce((sum, b) => sum + b.inputTokens, 0)
  const outputTotal = activeBuckets.reduce((sum, b) => sum + b.outputTokens, 0)

  const refresh = () => {
    providersQuery.refetch()
    if (selected?.configured) usageQuery.refetch()
  }
  const isFetching = providersQuery.isFetching || usageQuery.isFetching

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">omni-ai-watch</h1>
          <p className="text-sm text-muted-foreground">
            AI usage across providers — last 7 days (UTC)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {usageQuery.dataUpdatedAt > 0 && (
            <span className="text-xs text-muted-foreground">
              Updated {format(new Date(usageQuery.dataUpdatedAt), "HH:mm:ss")}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isFetching}
          >
            <RefreshCw
              className={isFetching ? "mr-2 animate-spin" : "mr-2"}
              data-icon="inline-start"
            />
            Refresh
          </Button>
        </div>
      </header>

      <Tabs
        value={selected?.id ?? null}
        onValueChange={setSelectedId}
        className="w-full"
      >
        <TabsList>
          {providers.map((p) => (
            <TabsTrigger key={p.id} value={p.id}>
              {p.name}
              {!p.configured && (
                <Badge variant="secondary" className="ml-2">
                  not configured
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <DashboardBody
        providersError={providersQuery.error}
        usageError={usageQuery.error}
        isLoading={providersQuery.isPending || usageQuery.isLoading}
        provider={selected}
        hasData={activeBuckets.length > 0}
        inputTotal={inputTotal}
        outputTotal={outputTotal}
        buckets={buckets}
        range={range}
      />
    </div>
  )
}

function DashboardBody({
  providersError,
  usageError,
  isLoading,
  provider,
  hasData,
  inputTotal,
  outputTotal,
  buckets,
  range,
}: {
  providersError: unknown
  usageError: unknown
  isLoading: boolean
  provider?: ProviderInfo
  hasData: boolean
  inputTotal: number
  outputTotal: number
  buckets: UsageBucket[]
  range: UsageRange
}) {
  const error = usageError ?? providersError

  if (isLoading) return <LoadingState />

  if (error) {
    const apiError = error instanceof ApiError ? error : null
    if (apiError?.status === 503 && provider) {
      return <MissingCredentials provider={provider} />
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>
            {error instanceof Error ? error.message : "Unknown error"}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!provider) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No providers registered</CardTitle>
        </CardHeader>
      </Card>
    )
  }

  if (!provider.configured) {
    return <MissingCredentials provider={provider} />
  }

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No usage recorded</CardTitle>
          <CardDescription>
            No token usage reported by {provider.name} for the last 7 days.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const compact = new Intl.NumberFormat("en", { notation: "compact" })

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Input tokens" value={inputTotal} />
        <StatCard title="Output tokens" value={outputTotal} />
        <StatCard title="Total tokens" value={inputTotal + outputTotal} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily tokens</CardTitle>
          <CardDescription>
            * today is partial. Input includes cached tokens.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-72 w-full">
            <BarChart data={toChartData(buckets, range)} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="day"
                tickLine={false}
                tickMargin={8}
                axisLine={false}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(value: number) => compact.format(value)}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="input"
                stackId="tokens"
                fill="var(--color-input)"
              />
              <Bar
                dataKey="output"
                stackId="tokens"
                fill="var(--color-output)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </>
  )
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">
          {numberFormat.format(value)}
        </div>
      </CardContent>
    </Card>
  )
}

function MissingCredentials({
  provider,
}: {
  provider: {
    name: string
    credentials: { env: string; kind: string; hint?: string; present: boolean }[]
  }
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{provider.name} is not configured</CardTitle>
        <CardDescription>
          Add the following to <code>.env.local</code> and restart the dev
          server:
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {provider.credentials.map((c) => (
          <div key={c.env} className="text-sm">
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              {c.env}
            </code>
            <span className="ml-2 text-muted-foreground">{c.kind}</span>
            {c.hint && (
              <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-96" />
    </div>
  )
}

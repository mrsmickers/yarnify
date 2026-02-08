import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  BarChart3,
  Phone,
  TrendingUp,
  Clock,
  SmilePlus,
  Building2,
  Users,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { axiosInstance, handleApiError } from '@/api/axios-instance'

// ─── Types ───────────────────────────────────────────────────────────────────

interface OverviewStats {
  totalCalls: number
  totalDuration: number
  avgSentiment: number | null
  avgConfidence: number | null
  callsByDirection: Array<{ direction: string; count: number }>
  topAgents: Array<{
    agentId: string
    agentName: string
    callCount: number
  }>
}

interface SentimentBreakdown {
  sentiment: string
  count: number
}

interface VolumeTrend {
  date: string
  count: number
}

interface AgentPerformance {
  agentId: string
  agentName: string
  callCount: number
  avgSentiment: number | null
}

interface TopCompany {
  companyId: string
  companyName: string
  callCount: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DATE_RANGES = [
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 30 days', value: '30' },
  { label: 'Last 90 days', value: '90' },
  { label: 'All time', value: 'all' },
]

const SENTIMENT_COLOURS: Record<string, string> = {
  Positive: '#22c55e',
  Neutral: '#3b82f6',
  Negative: '#ef4444',
  Undetermined: '#94a3b8',
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function sentimentLabel(score: number | null): {
  label: string
  colour: string
} {
  if (score === null) return { label: 'N/A', colour: 'text-muted-foreground' }
  if (score >= 0.75) return { label: 'Positive', colour: 'text-green-500' }
  if (score >= 0.4) return { label: 'Neutral', colour: 'text-blue-500' }
  return { label: 'Negative', colour: 'text-red-500' }
}

function confidenceLabel(score: number | null): string {
  if (score === null) return 'N/A'
  return `${Math.round(score * 100)}%`
}

// ─── API Hooks ───────────────────────────────────────────────────────────────

function buildParams(startDate?: string, endDate?: string) {
  const params: Record<string, string> = {}
  if (startDate) params.startDate = startDate
  if (endDate) params.endDate = endDate
  return params
}

function useDashboardOverview(startDate?: string, endDate?: string) {
  return useQuery<OverviewStats>({
    queryKey: ['dashboard', 'overview', startDate, endDate],
    queryFn: () =>
      axiosInstance({
        url: '/api/v1/dashboard/overview',
        method: 'GET',
        params: buildParams(startDate, endDate),
      }),
    staleTime: 60_000,
  })
}

function useSentimentBreakdown(startDate?: string, endDate?: string) {
  return useQuery<SentimentBreakdown[]>({
    queryKey: ['dashboard', 'sentiment', startDate, endDate],
    queryFn: () =>
      axiosInstance({
        url: '/api/v1/dashboard/sentiment',
        method: 'GET',
        params: buildParams(startDate, endDate),
      }),
    staleTime: 60_000,
  })
}

function useVolumeTrend(startDate?: string, endDate?: string) {
  return useQuery<VolumeTrend[]>({
    queryKey: ['dashboard', 'volume', startDate, endDate],
    queryFn: () =>
      axiosInstance({
        url: '/api/v1/dashboard/volume',
        method: 'GET',
        params: buildParams(startDate, endDate),
      }),
    staleTime: 60_000,
  })
}

function useAgentPerformance(startDate?: string, endDate?: string) {
  return useQuery<AgentPerformance[]>({
    queryKey: ['dashboard', 'agents', startDate, endDate],
    queryFn: () =>
      axiosInstance({
        url: '/api/v1/dashboard/agents',
        method: 'GET',
        params: buildParams(startDate, endDate),
      }),
    staleTime: 60_000,
  })
}

function useTopCompanies(startDate?: string, endDate?: string) {
  return useQuery<TopCompany[]>({
    queryKey: ['dashboard', 'companies', startDate, endDate],
    queryFn: () =>
      axiosInstance({
        url: '/api/v1/dashboard/companies',
        method: 'GET',
        params: buildParams(startDate, endDate),
      }),
    staleTime: 60_000,
  })
}

// ─── Components ──────────────────────────────────────────────────────────────

function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  valueClassName,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: typeof Phone
  valueClassName?: string
}) {
  return (
    <Card className="border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${valueClassName ?? ''}`}>
          {value}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}

function SentimentPieChart({ data }: { data: SentimentBreakdown[] }) {
  const filtered = data.filter((d) => d.count > 0)
  if (filtered.length === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center text-muted-foreground">
        No sentiment data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={filtered}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={3}
          dataKey="count"
          nameKey="sentiment"
          label={({ sentiment, percent }) =>
            `${sentiment} ${(percent * 100).toFixed(0)}%`
          }
          labelLine={false}
        >
          {filtered.map((entry) => (
            <Cell
              key={entry.sentiment}
              fill={SENTIMENT_COLOURS[entry.sentiment] ?? '#94a3b8'}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}

function VolumeChart({ data }: { data: VolumeTrend[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        No call volume data available
      </div>
    )
  }

  const chartData = data.map((d) => ({
    ...d,
    label: dayjs(d.date).format('D MMM'),
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#DEDC00" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#DEDC00" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border)"
          opacity={0.5}
        />
        <XAxis
          dataKey="label"
          stroke="var(--muted-foreground)"
          fontSize={12}
          tickLine={false}
        />
        <YAxis
          stroke="var(--muted-foreground)"
          fontSize={12}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          labelFormatter={(label) => `Date: ${label}`}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#DEDC00"
          strokeWidth={2}
          fill="url(#volumeGradient)"
          name="Calls"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function AgentTable({ data }: { data: AgentPerformance[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-muted-foreground">
        No agent data available
      </div>
    )
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50">
            <th className="pb-2 text-left font-medium text-muted-foreground">
              Agent
            </th>
            <th className="pb-2 text-right font-medium text-muted-foreground">
              Calls
            </th>
            <th className="pb-2 text-right font-medium text-muted-foreground">
              Avg Sentiment
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((agent) => {
            const sentiment = sentimentLabel(agent.avgSentiment)
            return (
              <tr
                key={agent.agentId}
                className="border-b border-border/30 last:border-0"
              >
                <td className="py-2.5 font-medium">{agent.agentName}</td>
                <td className="py-2.5 text-right tabular-nums">
                  {agent.callCount}
                </td>
                <td className={`py-2.5 text-right font-medium ${sentiment.colour}`}>
                  {sentiment.label}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function CompanyTable({ data }: { data: TopCompany[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-muted-foreground">
        No company data available
      </div>
    )
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50">
            <th className="pb-2 text-left font-medium text-muted-foreground">
              #
            </th>
            <th className="pb-2 text-left font-medium text-muted-foreground">
              Company
            </th>
            <th className="pb-2 text-right font-medium text-muted-foreground">
              Calls
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((company, idx) => (
            <tr
              key={company.companyId}
              className="border-b border-border/30 last:border-0"
            >
              <td className="py-2.5 text-muted-foreground">{idx + 1}</td>
              <td className="py-2.5 font-medium">{company.companyName}</td>
              <td className="py-2.5 text-right tabular-nums">
                {company.callCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LoadingCard({ className }: { className?: string }) {
  return (
    <Card className={`border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F] ${className ?? ''}`}>
      <CardContent className="pt-6">
        <Skeleton className="h-6 w-24 mb-3" />
        <Skeleton className="h-10 w-32 mb-2" />
        <Skeleton className="h-4 w-20" />
      </CardContent>
    </Card>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState('30')

  const { startDate, endDate } = useMemo(() => {
    if (dateRange === 'all') return {}
    const end = dayjs().endOf('day').toISOString()
    const start = dayjs()
      .subtract(parseInt(dateRange), 'day')
      .startOf('day')
      .toISOString()
    return { startDate: start, endDate: end }
  }, [dateRange])

  const overview = useDashboardOverview(startDate, endDate)
  const sentiment = useSentimentBreakdown(startDate, endDate)
  const volume = useVolumeTrend(startDate, endDate)
  const agents = useAgentPerformance(startDate, endDate)
  const companies = useTopCompanies(startDate, endDate)

  const sentimentInfo = sentimentLabel(overview.data?.avgSentiment ?? null)

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        title="Dashboard"
        description="Call analytics overview — key metrics, trends, and insights"
        actions={
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {/* Stats Cards */}
      {overview.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
        </div>
      ) : overview.error ? (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-6 text-center text-red-500">
            Failed to load overview: {handleApiError(overview.error)}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Calls"
            value={overview.data?.totalCalls ?? 0}
            subtitle={
              overview.data?.callsByDirection
                ?.map((d) => `${d.count} ${d.direction.toLowerCase()}`)
                .join(', ') ?? ''
            }
            icon={Phone}
          />
          <StatsCard
            title="Avg Sentiment"
            value={sentimentInfo.label}
            valueClassName={sentimentInfo.colour}
            subtitle={
              overview.data?.avgSentiment !== null
                ? `Score: ${((overview.data?.avgSentiment ?? 0) * 100).toFixed(0)}%`
                : undefined
            }
            icon={SmilePlus}
          />
          <StatsCard
            title="Avg Confidence"
            value={confidenceLabel(overview.data?.avgConfidence ?? null)}
            icon={TrendingUp}
          />
          <StatsCard
            title="Total Duration"
            value={formatDuration(overview.data?.totalDuration ?? 0)}
            subtitle={`${overview.data?.totalCalls ?? 0} calls`}
            icon={Clock}
          />
        </div>
      )}

      {/* Call Volume Chart */}
      <Card className="border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-[#DEDC00]" />
            Call Volume
          </CardTitle>
          <CardDescription>Calls per day over the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          {volume.isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : volume.error ? (
            <div className="h-[300px] flex items-center justify-center text-red-500">
              Failed to load volume data
            </div>
          ) : (
            <VolumeChart data={volume.data ?? []} />
          )}
        </CardContent>
      </Card>

      {/* Two-Column: Sentiment + Agent Performance */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Sentiment Breakdown */}
        <Card className="border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <SmilePlus className="h-5 w-5 text-[#DEDC00]" />
              Sentiment Breakdown
            </CardTitle>
            <CardDescription>
              Distribution of call sentiments
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sentiment.isLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : sentiment.error ? (
              <div className="h-[250px] flex items-center justify-center text-red-500">
                Failed to load sentiment data
              </div>
            ) : (
              <SentimentPieChart data={sentiment.data ?? []} />
            )}
          </CardContent>
        </Card>

        {/* Agent Performance */}
        <Card className="border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-[#DEDC00]" />
              Agent Performance
            </CardTitle>
            <CardDescription>
              Calls and sentiment by agent
            </CardDescription>
          </CardHeader>
          <CardContent>
            {agents.isLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : agents.error ? (
              <div className="h-[250px] flex items-center justify-center text-red-500">
                Failed to load agent data
              </div>
            ) : (
              <AgentTable data={agents.data ?? []} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Companies */}
      <Card className="border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-[#DEDC00]" />
            Top Companies
          </CardTitle>
          <CardDescription>Most frequent callers by volume</CardDescription>
        </CardHeader>
        <CardContent>
          {companies.isLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : companies.error ? (
            <div className="h-[200px] flex items-center justify-center text-red-500">
              Failed to load company data
            </div>
          ) : (
            <CompanyTable data={companies.data ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

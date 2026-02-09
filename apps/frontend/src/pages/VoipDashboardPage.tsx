import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  CalendarIcon,
  FilterXIcon,
  RefreshCcwIcon,
  RotateCcwIcon,
  UserCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import dayjs from 'dayjs'

import {
  useCallAnalysisControllerGetCalls,
  useCallAnalysisControllerGetCompanyList,
  useCallAnalysisControllerGetAgentList,
} from '@/api/api-client'
import type {
  CallResponseDto,
  CompanyListItemDto,
  AgentListItemDto,
} from '@/api/api-client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { DataTable } from '@/components/ui/data-table'
import type { ColumnDef } from '@tanstack/react-table'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { useCurrentUser } from '@/hooks/useCurrentUser'

interface CallStat {
  title: string
  value: string | number
  percentage?: string
  colorClass?: string
}

interface TransformedCallLog {
  id: string
  date: string
  time: string
  companyName: string
  sentiment: 'Positive' | 'Negative' | 'Neutral' | 'Unknown'
  mood: string
  agentName: string
  aiConfidence: string
}

const SCOPE_LABELS: Record<string, string> = {
  admin: '',
  manager: 'Showing calls for your department',
  team_lead: 'Showing calls for your team',
  user: 'Showing your calls',
}

/**
 * Helper to update a single URL search param.
 * When a filter (non-page) changes, page resets to 1.
 */
function updateSearchParam(
  setSearchParams: ReturnType<typeof useSearchParams>[1],
  key: string,
  value: string | undefined
) {
  setSearchParams(
    (prev) => {
      const next = new URLSearchParams(prev)
      if (value) {
        next.set(key, value)
      } else {
        next.delete(key)
      }
      // Reset to page 1 when any filter (non-pagination) changes
      if (key !== 'page' && key !== 'limit') {
        next.delete('page')
      }
      return next
    },
    { replace: true }
  )
}

const VoipDashboardPage = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [stats, setStats] = useState<CallStat[]>([])
  const [callLogs, setCallLogs] = useState<TransformedCallLog[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const { data: currentUser } = useCurrentUser()

  // ── Derive ALL filter/pagination state from URL search params ──
  const pageIndex = (Number(searchParams.get('page')) || 1) - 1 // 0-based for DataTable
  const pageSize = Number(searchParams.get('limit')) || 10
  const companyIdFilter = searchParams.get('companyId') || ''
  const agentIdFilter = searchParams.get('agentId') || ''
  const sentimentFilter = searchParams.get('sentiment') || ''
  const startDateFilterStr = searchParams.get('startDate') || ''
  const endDateFilterStr = searchParams.get('endDate') || ''

  // Parsed Date objects for the Calendar pickers
  const startDateFilter = useMemo(
    () =>
      startDateFilterStr && dayjs(startDateFilterStr).isValid()
        ? dayjs(startDateFilterStr).toDate()
        : undefined,
    [startDateFilterStr]
  )
  const endDateFilter = useMemo(
    () =>
      endDateFilterStr && dayjs(endDateFilterStr).isValid()
        ? dayjs(endDateFilterStr).toDate()
        : undefined,
    [endDateFilterStr]
  )

  // Auto-show filters when any filter is active on mount
  useEffect(() => {
    if (companyIdFilter || agentIdFilter || sentimentFilter || startDateFilterStr || endDateFilterStr) {
      setShowFilters(true)
    }
  }, []) // Only on mount

  // Data for filter dropdowns
  const { data: companyList } = useCallAnalysisControllerGetCompanyList()
  const { data: agentList } = useCallAnalysisControllerGetAgentList()

  // API call parameters — derived directly from URL state
  const queryParams = {
    page: pageIndex + 1,
    limit: pageSize,
    companyId: companyIdFilter || undefined,
    agentId: agentIdFilter || undefined,
    sentiment: sentimentFilter || undefined,
    startDate: startDateFilterStr || undefined,
    endDate: endDateFilterStr || undefined,
  }

  const {
    data: paginatedCallsData,
    isLoading,
    error,
    refetch,
  } = useCallAnalysisControllerGetCalls(queryParams, {
    query: {
      staleTime: 5 * 60 * 1000,
      refetchInterval: 10000,
    },
  })

  // ── URL update helpers ──
  const setPage = useCallback(
    (newPageIndex: number) => {
      updateSearchParam(setSearchParams, 'page', String(newPageIndex + 1))
    },
    [setSearchParams]
  )

  const setPageSizeParam = useCallback(
    (newSize: number) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('limit', String(newSize))
          next.delete('page') // Reset to page 1
          return next
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const handleClearFilters = useCallback(() => {
    setSearchParams({}, { replace: true })
  }, [setSearchParams])

  useEffect(() => {
    if (paginatedCallsData?.data) {
      const calls = paginatedCallsData.data.filter(
        (call: CallResponseDto) => call.callStatus !== 'INTERNAL_CALL_SKIPPED'
      )

      const transformedLogs: TransformedCallLog[] = calls.map(
        (call: CallResponseDto): TransformedCallLog => {
          const analysisData = call.analysis || {}
          const sentiment =
            (analysisData.sentiment as TransformedCallLog['sentiment']) ||
            'Unknown'
          const mood = (analysisData.mood as string) || 'N/A'
          const aiConfidence = (analysisData.confidence_level as string)
            ? `${analysisData.confidence_level}`
            : 'N/A'
          const companyName =
            typeof call === 'object' && 'companyName' in call
              ? (call as { companyName?: string }).companyName || 'N/A'
              : 'N/A'

          return {
            id: call.id,
            date: new Date(call.startTime).toLocaleDateString(),
            time: new Date(call.startTime).toLocaleTimeString('en-GB'),
            companyName,
            sentiment,
            mood,
            agentName: call.agentName || 'N/A',
            aiConfidence,
          }
        }
      )
      setCallLogs(transformedLogs)

      const { metrics } = paginatedCallsData

      setStats([
        {
          title: 'Total Calls',
          value: paginatedCallsData?.total || 0,
          colorClass: 'border-[#DEDC00]',
        },
        {
          title: 'Positive Sentiment',
          value: metrics.totalPositiveSentiment,
          percentage:
            paginatedCallsData?.total > 0
              ? `${(
                  (metrics.totalPositiveSentiment / paginatedCallsData.total) *
                  100
                ).toFixed(0)}%`
              : '0%',
          colorClass: 'border-[#F8AB08]',
        },
        {
          title: 'Negative Sentiment',
          value: metrics.totalNegativeSentiment,
          percentage:
            paginatedCallsData?.total > 0
              ? `${(
                  (metrics.totalNegativeSentiment / paginatedCallsData.total) *
                  100
                ).toFixed(0)}%`
              : '0%',
          colorClass: 'border-[#F87171]',
        },
        {
          title: 'AI Confidence',
          value: `${metrics.averageConfidence}%`,
          colorClass: 'border-[#824192]',
        },
      ])
    }
  }, [paginatedCallsData])

  // Helper functions and column definitions
  const getSentimentBadgeVariant = (
    sentiment: TransformedCallLog['sentiment']
  ): 'default' | 'destructive' | 'outline' | 'secondary' => {
    switch (sentiment) {
      case 'Positive':
        return 'default'
      case 'Negative':
        return 'destructive'
      case 'Neutral':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  const getSentimentBgColor = (
    sentiment: TransformedCallLog['sentiment']
  ): string => {
    switch (sentiment) {
      case 'Positive':
        return 'bg-green-100 text-green-800'
      case 'Negative':
        return 'bg-red-100 text-red-800'
      case 'Neutral':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const columns: ColumnDef<TransformedCallLog>[] = [
    {
      accessorKey: 'date',
      header: 'Date',
    },
    {
      accessorKey: 'time',
      header: 'Time',
    },
    {
      accessorKey: 'companyName',
      header: 'Company',
    },
    {
      accessorKey: 'sentiment',
      header: 'Sentiment',
      cell: ({ row }) => {
        const sentiment = row.original.sentiment
        return (
          <Badge
            className={getSentimentBgColor(sentiment)}
            variant={getSentimentBadgeVariant(sentiment)}
          >
            {sentiment}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'mood',
      header: 'Mood',
    },
    {
      accessorKey: 'agentName',
      header: 'Agent Name',
    },
    {
      accessorKey: 'aiConfidence',
      header: 'AI Confidence',
      cell: ({ row }) => {
        const confidence = row.original.aiConfidence
        return (
          <Badge
            variant={
              confidence === 'High'
                ? 'default'
                : confidence === 'Medium'
                ? 'secondary'
                : confidence === 'Low'
                ? 'destructive'
                : 'outline'
            }
          >
            {confidence}
          </Badge>
        )
      },
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const call = row.original
        return (
          <div className="text-right">
            <Link
              to={`/calls/${call.id}`}
              className={buttonVariants({
                variant: 'secondary',
                size: 'sm',
              })}
              onClick={(e) => e.stopPropagation()}
            >
              More
            </Link>
          </div>
        )
      },
    },
  ]

  if (error) {
    const errorMessage =
      (error as { message?: string })?.message || 'An unknown error occurred'
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Card className="max-w-md border border-destructive/20 bg-card/70 p-8 text-center shadow-lg dark:border-[#442323]">
          <CardHeader className="space-y-3 text-center">
            <CardTitle className="text-xl font-semibold text-destructive">
              We couldn't load your dashboard
            </CardTitle>
            <CardDescription>{errorMessage}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <PageHeader
        title="VoIP Dashboard"
        description="Monitor conversation quality, sentiment trends, and operational performance across every client call in real time."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                handleClearFilters()
                setShowFilters(false)
              }}
            >
              <RotateCcwIcon className="mr-2 h-4 w-4" />
              Reset view
            </Button>
            <Button onClick={() => refetch()}>
              <RefreshCcwIcon className="mr-2 h-4 w-4" />
              Refresh data
            </Button>
          </>
        }
      />

      {/* Scope indicator for non-admin users */}
      {currentUser?.role && currentUser.role !== 'admin' && SCOPE_LABELS[currentUser.role] && (
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
          <UserCircle2 className="h-4 w-4 shrink-0" />
          <span>{SCOPE_LABELS[currentUser.role]}</span>
          {(currentUser.role === 'manager' || currentUser.role === 'team_lead') && currentUser.department && (
            <Badge variant="secondary" className="ml-1 text-xs">{currentUser.department}</Badge>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading && stats.length === 0 ? (
          <>
            {Array.from({ length: 4 }).map((_, index) => (
              <Card
                key={`skeleton-stat-${index}`}
                className="border-l-4 border-border/60 bg-card/60 backdrop-blur-sm"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-6 w-1/2 mb-1" />
                  <Skeleton className="h-3 w-1/4" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          stats.map((stat) => (
            <Card
              key={stat.title}
              className={cn(
                'border-l-4 border-border/60 bg-card/70 backdrop-blur-sm shadow-[0_16px_40px_-28px_rgba(12,17,27,0.9)] transition-transform hover:-translate-y-0.5 hover:shadow-[0_24px_45px_-28px_rgba(12,17,27,0.85)] dark:border-[#242F3F]',
                stat.colorClass
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground/80">
                  {stat.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-foreground">
                  {stat.value}
                  {stat.percentage && (
                    <span className="ml-2 text-xs font-medium text-muted-foreground">
                      ({stat.percentage})
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      {/* Call List Table */}
      <Card className="border border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Call List</CardTitle>
            <p className="text-sm text-muted-foreground">
              Displaying {callLogs.length} of {paginatedCallsData?.total || 0}{' '}
              total calls
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? (
              <>
                <FilterXIcon className="w-4 h-4 mr-2" />
                Hide Filters
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-4 h-4 mr-2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"
                  />
                </svg>
                Show Filters
              </>
            )}
          </Button>
        </CardHeader>

        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="border-b border-border/70 px-6 pb-4"
          >
            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {/* Company Filter */}
              <div className="space-y-1">
                <Label htmlFor="companyFilter">Company</Label>
                <Select
                  value={companyIdFilter || 'ALL_COMPANIES'}
                  onValueChange={(value) => {
                    updateSearchParam(
                      setSearchParams,
                      'companyId',
                      value === 'ALL_COMPANIES' ? undefined : value
                    )
                  }}
                >
                  <SelectTrigger id="companyFilter">
                    <SelectValue placeholder="Select Company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL_COMPANIES">All Companies</SelectItem>
                    {companyList?.map((company: CompanyListItemDto) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Agent Filter */}
              <div className="space-y-1">
                <Label htmlFor="agentFilter">Agent</Label>
                <Select
                  value={agentIdFilter || 'ALL_AGENTS'}
                  onValueChange={(value) => {
                    updateSearchParam(
                      setSearchParams,
                      'agentId',
                      value === 'ALL_AGENTS' ? undefined : value
                    )
                  }}
                >
                  <SelectTrigger id="agentFilter">
                    <SelectValue placeholder="Select Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL_AGENTS">All Agents</SelectItem>
                    {agentList?.map((agent: AgentListItemDto) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sentiment Filter */}
              <div className="space-y-1">
                <Label htmlFor="sentimentFilter">Sentiment</Label>
                <Select
                  value={sentimentFilter || 'ALL_SENTIMENTS'}
                  onValueChange={(value) => {
                    updateSearchParam(
                      setSearchParams,
                      'sentiment',
                      value === 'ALL_SENTIMENTS' ? undefined : value
                    )
                  }}
                >
                  <SelectTrigger id="sentimentFilter">
                    <SelectValue placeholder="Select Sentiment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL_SENTIMENTS">
                      All Sentiments
                    </SelectItem>
                    <SelectItem value="Positive">Positive</SelectItem>
                    <SelectItem value="Negative">Negative</SelectItem>
                    <SelectItem value="Neutral">Neutral</SelectItem>
                    <SelectItem value="Unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date Filter */}
              <div className="space-y-1">
                <Label htmlFor="startDateFilter">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="startDateFilter"
                      variant={'outline'}
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !startDateFilter && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDateFilter ? (
                        dayjs(startDateFilter).format('MMM D, YYYY')
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDateFilter}
                      onSelect={(date) => {
                        updateSearchParam(
                          setSearchParams,
                          'startDate',
                          date ? dayjs(date).format('YYYY-MM-DD') : undefined
                        )
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* End Date Filter */}
              <div className="space-y-1">
                <Label htmlFor="endDateFilter">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="endDateFilter"
                      variant={'outline'}
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !endDateFilter && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDateFilter ? (
                        dayjs(endDateFilter).format('MMM D, YYYY')
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDateFilter}
                      onSelect={(date) => {
                        updateSearchParam(
                          setSearchParams,
                          'endDate',
                          date ? dayjs(date).format('YYYY-MM-DD') : undefined
                        )
                      }}
                      disabled={(date: Date) =>
                        startDateFilter ? date < startDateFilter : false
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={handleClearFilters} size="sm">
                <RotateCcwIcon className="w-4 h-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </motion.div>
        )}

        <CardContent className="relative min-h-[200px]">
          {' '}
          {isLoading ? (
            <motion.div
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm p-4 space-y-3"
            >
              <div className="w-full space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-5/6" />
                <Skeleton className="h-8 w-4/6" />
              </div>
              <p className="text-sm text-gray-600">Loading calls...</p>
            </motion.div>
          ) : (
            <motion.div
              key="data-table"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <DataTable
                columns={columns}
                data={callLogs}
                pageCount={paginatedCallsData?.totalPages || 1}
                pageSize={pageSize}
                pageIndex={pageIndex}
                onPageChange={setPage}
                onPageSizeChange={setPageSizeParam}
                onRowClick={(row) => {
                  navigate(`/calls/${row.id}`)
                }}
              />
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default VoipDashboardPage

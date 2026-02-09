import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarIcon,
  FilterXIcon,
  RefreshCcwIcon,
  RotateCcwIcon,
  UserCircle2,
  AlertCircle,
  Ticket,
} from 'lucide-react'

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
import { Skeleton } from '@/components/ui/skeleton'
import { DataTable } from '@/components/ui/data-table'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'
import { axiosInstance, handleApiError } from '@/api/axios-instance'
import type { ColumnDef } from '@tanstack/react-table'
import { AddToTicketModal } from '@/components/AddToTicketModal'

interface TransformedCallLog {
  id: string
  date: string
  time: string
  companyName: string
  sentiment: 'Positive' | 'Negative' | 'Neutral' | 'Unknown'
  mood: string
  aiConfidence: string
  summary: string // For pushing to CW tickets
}

interface MyCallsResponse {
  data: any[]
  total: number
  page: number
  limit: number
  totalPages: number
  metrics: {
    totalPositiveSentiment: number
    totalNegativeSentiment: number
    totalNeutralSentiment: number
    averageConfidence: number
  }
  agentLinked: boolean
  agentName?: string
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

const MyCallsPage = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [callLogs, setCallLogs] = useState<TransformedCallLog[]>([])
  const [showFilters, setShowFilters] = useState(false)
  
  // Add to Ticket modal state
  const [ticketModalOpen, setTicketModalOpen] = useState(false)
  const [selectedCallForTicket, setSelectedCallForTicket] = useState<TransformedCallLog | null>(null)
  
  // Fetch user permissions for CW push
  const { data: userPermissions = [] } = useQuery<string[]>({
    queryKey: ['my-permissions'],
    queryFn: async () => {
      return await axiosInstance<string[]>({
        url: '/api/v1/permissions/me',
        method: 'GET',
      })
    },
    staleTime: 5 * 60 * 1000,
  })
  
  const canPushToCW = userPermissions.includes('connectwise.push')

  // ── Derive ALL filter/pagination state from URL search params ──
  const pageIndex = (Number(searchParams.get('page')) || 1) - 1
  const pageSize = Number(searchParams.get('limit')) || 10
  const sentimentFilter = searchParams.get('sentiment') || ''
  const startDateFilterStr = searchParams.get('startDate') || ''
  const endDateFilterStr = searchParams.get('endDate') || ''

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
    if (sentimentFilter || startDateFilterStr || endDateFilterStr) {
      setShowFilters(true)
    }
  }, []) // Only on mount

  // Build query string for API
  const apiQueryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set('page', String(pageIndex + 1))
    params.set('limit', String(pageSize))
    if (sentimentFilter) params.set('sentiment', sentimentFilter)
    if (startDateFilterStr) params.set('startDate', startDateFilterStr)
    if (endDateFilterStr) params.set('endDate', endDateFilterStr)
    return params.toString()
  }, [pageIndex, pageSize, sentimentFilter, startDateFilterStr, endDateFilterStr])

  const {
    data: myCallsData,
    isLoading,
    error,
    refetch,
  } = useQuery<MyCallsResponse>({
    queryKey: [
      'my-calls',
      pageIndex,
      pageSize,
      sentimentFilter,
      startDateFilterStr,
      endDateFilterStr,
    ],
    queryFn: async () => {
      return await axiosInstance<MyCallsResponse>({
        url: `/api/v1/call-analysis/calls/mine?${apiQueryString}`,
        method: 'GET',
      })
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10000,
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
          next.delete('page')
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
    if (myCallsData?.data) {
      const logs: TransformedCallLog[] = myCallsData.data.map((call: any) => {
        const analysisData = call.analysis || {}
        return {
          id: call.id,
          date: new Date(call.startTime).toLocaleDateString(),
          time: new Date(call.startTime).toLocaleTimeString('en-GB'),
          companyName:
            (call as any).companyName || 'N/A',
          sentiment:
            (analysisData.sentiment as TransformedCallLog['sentiment']) ||
            'Unknown',
          mood: (analysisData.mood as string) || 'N/A',
          aiConfidence: analysisData.confidence_level
            ? `${analysisData.confidence_level}`
            : 'N/A',
          summary: (analysisData.summary as string) || '',
        }
      })
      setCallLogs(logs)
    }
  }, [myCallsData])

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
    { accessorKey: 'date', header: 'Date' },
    { accessorKey: 'time', header: 'Time' },
    { accessorKey: 'companyName', header: 'Company' },
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
    { accessorKey: 'mood', header: 'Mood' },
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
          <div className="flex items-center justify-end gap-2">
            {canPushToCW && call.summary && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedCallForTicket(call)
                  setTicketModalOpen(true)
                }}
                title="Add call notes to a ConnectWise ticket"
              >
                <Ticket className="h-4 w-4" />
              </Button>
            )}
            <Link
              to={`/calls/${call.id}`}
              className={buttonVariants({ variant: 'secondary', size: 'sm' })}
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
              We couldn't load your calls
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

  // Not linked state
  if (!isLoading && myCallsData && !myCallsData.agentLinked) {
    return (
      <div className="space-y-10">
        <PageHeader
          title="My Calls"
          description="View your own call recordings and analysis"
        />
        <Card className="border border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Account Not Linked
            </h3>
            <p className="text-muted-foreground max-w-md">
              Your account isn't linked to a phone agent yet. Ask an admin to
              link your account in Agent Management, or it may be auto-linked
              on your next login.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const stats = myCallsData
    ? [
        {
          title: 'My Total Calls',
          value: myCallsData.total || 0,
          colorClass: 'border-[#DEDC00]',
        },
        {
          title: 'Positive Sentiment',
          value: myCallsData.metrics.totalPositiveSentiment,
          percentage:
            myCallsData.total > 0
              ? `${((myCallsData.metrics.totalPositiveSentiment / myCallsData.total) * 100).toFixed(0)}%`
              : '0%',
          colorClass: 'border-[#F8AB08]',
        },
        {
          title: 'Negative Sentiment',
          value: myCallsData.metrics.totalNegativeSentiment,
          percentage:
            myCallsData.total > 0
              ? `${((myCallsData.metrics.totalNegativeSentiment / myCallsData.total) * 100).toFixed(0)}%`
              : '0%',
          colorClass: 'border-[#F87171]',
        },
        {
          title: 'AI Confidence',
          value: `${myCallsData.metrics.averageConfidence}%`,
          colorClass: 'border-[#824192]',
        },
      ]
    : []

  return (
    <div className="space-y-10">
      <PageHeader
        title="My Calls"
        description={
          myCallsData?.agentName
            ? `Showing calls for agent: ${myCallsData.agentName}`
            : 'View your own call recordings and analysis'
        }
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
                  {'percentage' in stat && stat.percentage && (
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
            <CardTitle>My Call List</CardTitle>
            <p className="text-sm text-muted-foreground">
              Displaying {callLogs.length} of {myCallsData?.total || 0} total
              calls
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
                <UserCircle2 className="w-4 h-4 mr-2" />
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
            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* Sentiment Filter */}
              <div className="space-y-1">
                <Label htmlFor="sentimentFilter">Sentiment</Label>
                <Select
                  value={sentimentFilter || 'ALL_SENTIMENTS'}
                  onValueChange={(value) =>
                    updateSearchParam(
                      setSearchParams,
                      'sentiment',
                      value === 'ALL_SENTIMENTS' ? undefined : value
                    )
                  }
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
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !startDateFilter && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDateFilter
                        ? dayjs(startDateFilter).format('MMM D, YYYY')
                        : 'Pick a date'}
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
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !endDateFilter && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDateFilter
                        ? dayjs(endDateFilter).format('MMM D, YYYY')
                        : 'Pick a date'}
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
              <p className="text-sm text-gray-600">Loading your calls...</p>
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
                pageCount={myCallsData?.totalPages || 1}
                pageSize={pageSize}
                pageIndex={pageIndex}
                onPageChange={setPage}
                onPageSizeChange={setPageSizeParam}
                onRowClick={(row) => navigate(`/calls/${row.id}`)}
              />
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Add to Ticket Modal */}
      {selectedCallForTicket && (
        <AddToTicketModal
          isOpen={ticketModalOpen}
          onClose={() => {
            setTicketModalOpen(false)
            setSelectedCallForTicket(null)
          }}
          callId={selectedCallForTicket.id}
          initialNotes={selectedCallForTicket.summary}
          companyName={selectedCallForTicket.companyName !== 'N/A' ? selectedCallForTicket.companyName : undefined}
        />
      )}
    </div>
  )
}

export default MyCallsPage

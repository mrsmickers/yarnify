import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCallAnalysisControllerGetCalls } from '@/api/api-client'
import type { CallResponseDto } from '@/api/api-client'
import { useEffect, useState } from 'react'
import { DataTable } from '@/components/ui/data-table'
import type { ColumnDef } from '@tanstack/react-table'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Skeleton } from '@/components/ui/skeleton'

interface CallStat {
  title: string
  value: string | number
  percentage?: string
  colorClass?: string
}

// Updated CallLog to better match CallResponseDto and include analysis data
interface TransformedCallLog {
  id: string
  date: string
  companyName: string
  sentiment: 'Positive' | 'Negative' | 'Neutral' | 'Unknown'
  mood: string
  agentName: string // Assuming agent name might come from analysis or a related field
  aiConfidence: string // Assuming AI confidence might come from analysis
  // Add other relevant fields from CallResponseDto.analysis if needed
}

const VoipDashboardPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [stats, setStats] = useState<CallStat[]>([])
  const [callLogs, setCallLogs] = useState<TransformedCallLog[]>([])

  // Initialize pageSize and pageIndex from URL search params or defaults
  const [pageSize, setPageSize] = useState(() => {
    const limit = searchParams.get('limit')
    return limit ? parseInt(limit, 10) : 10
  })
  const [pageIndex, setPageIndex] = useState(() => {
    const page = searchParams.get('page')
    return page ? parseInt(page, 10) - 1 : 0 // API is 1-based, local state is 0-based
  })

  const {
    data: paginatedCallsData,
    isLoading,
    error,
  } = useCallAnalysisControllerGetCalls(
    { page: pageIndex + 1, limit: pageSize },
    { query: { staleTime: 5 * 60 * 1000, refetchInterval: 10000 } }
  )

  useEffect(() => {
    if (paginatedCallsData?.data) {
      const calls = paginatedCallsData.data.filter(
        (call: CallResponseDto) => call.callStatus !== 'INTERNAL_CALL_SKIPPED'
      )

      // Transform calls for the log
      const transformedLogs: TransformedCallLog[] = calls.map(
        (call: CallResponseDto): TransformedCallLog => {
          const analysisData = call.analysis || {}
          const sentiment =
            (analysisData.overall_sentiment as TransformedCallLog['sentiment']) ||
            'Unknown'
          const mood = (analysisData.customer_mood as string) || 'N/A'
          const aiConfidence = (analysisData.ai_confidence_score as string)
            ? `${parseFloat(analysisData.ai_confidence_score as string).toFixed(
                0
              )}%`
            : 'N/A'
          const companyName =
            typeof call === 'object' && 'companyName' in call
              ? (call as { companyName?: string }).companyName || 'N/A'
              : 'N/A'

          return {
            id: call.id,
            date: new Date(call.startTime).toLocaleDateString(),
            companyName,
            sentiment,
            mood,
            agentName: call.agentName || 'N/A', // Assuming agent name might come from analysis or a related field
            aiConfidence,
          }
        }
      )
      setCallLogs(transformedLogs)

      // Calculate stats
      const currentViewTotalCalls = calls.length // Renamed to avoid confusion with API total
      let positiveSentiments = 0
      let negativeSentiments = 0
      let totalConfidenceScore = 0
      let callsWithConfidence = 0

      calls.forEach((call: CallResponseDto) => {
        // Added type for call parameter
        const sentiment = (
          call.analysis?.overall_sentiment as string
        )?.toLowerCase()
        if (sentiment === 'positive') positiveSentiments++
        if (sentiment === 'negative') negativeSentiments++

        const confidence = parseFloat(
          call.analysis?.ai_confidence_score as string
        )
        if (!isNaN(confidence)) {
          totalConfidenceScore += confidence
          callsWithConfidence++
        }
      })

      const avgConfidence =
        callsWithConfidence > 0 ? totalConfidenceScore / callsWithConfidence : 0

      setStats([
        {
          title: 'Total Calls',
          value: paginatedCallsData?.total || 0, // Use total from API response
          colorClass: 'border-blue-500',
        },
        {
          title: 'Positive Sentiment',
          value: positiveSentiments,
          percentage:
            currentViewTotalCalls > 0 // Use current view total for percentage calculation
              ? `${((positiveSentiments / currentViewTotalCalls) * 100).toFixed(
                  0
                )}%`
              : '0%',
          colorClass: 'border-green-500',
        },
        {
          title: 'Negative Sentiment',
          value: negativeSentiments,
          percentage:
            currentViewTotalCalls > 0 // Use current view total for percentage calculation
              ? `${((negativeSentiments / currentViewTotalCalls) * 100).toFixed(
                  0
                )}%`
              : '0%',
          colorClass: 'border-red-500',
        },
        {
          title: 'AI Confidence',
          value: `${avgConfidence.toFixed(0)}%`,
          colorClass: 'border-purple-500',
        },
      ])
    }
  }, [paginatedCallsData]) // Use paginatedCallsData in dependency array

  // Update URL search params when pageIndex or pageSize changes
  useEffect(() => {
    const newSearchParams = new URLSearchParams()
    newSearchParams.set('page', (pageIndex + 1).toString())
    newSearchParams.set('limit', pageSize.toString())
    setSearchParams(newSearchParams, { replace: true })
  }, [pageIndex, pageSize, setSearchParams])

  // Helper functions and column definitions moved inside the component
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
      default: // For "Unknown"
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
      default: // For "Unknown"
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getMoreButtonVariant = (
    sentiment: TransformedCallLog['sentiment']
  ): 'default' | 'destructive' | 'outline' | 'secondary' => {
    switch (sentiment) {
      case 'Positive':
        return 'default'
      case 'Negative':
        return 'destructive'
      case 'Neutral':
        return 'outline'
      default: // For "Unknown"
        return 'secondary'
    }
  }

  const columns: ColumnDef<TransformedCallLog>[] = [
    {
      accessorKey: 'date',
      header: 'Date',
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
              parseFloat(confidence) >= 80
                ? 'default'
                : parseFloat(confidence) >= 60
                ? 'secondary'
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
                variant: getMoreButtonVariant(call.sentiment),
                size: 'sm',
              })}
            >
              More
            </Link>
          </div>
        )
      },
    },
  ]

  // Removed the global isLoading check here, will handle it inline for the table

  if (error) {
    const errorMessage =
      (error as { message?: string })?.message || 'An unknown error occurred'
    return (
      <div className="container mx-auto p-8 text-center text-red-500">
        Error loading data: {errorMessage}
      </div>
    )
  }

  return (
    <div className="page-container space-y-8">
      <div className="bg-white rounded-lg shadow-sm p-8 border border-gray-100">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          VoIP Call Sentiment Dashboard
        </h1>
        <p className="text-gray-600">
          Track customer interactions and identify opportunities for improvement
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading && stats.length === 0 ? (
          <>
            {Array.from({ length: 4 }).map((_, index) => (
              <Card
                key={`skeleton-stat-${index}`}
                className="border-l-4 border-gray-200"
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
            <Card key={stat.title} className={`border-l-4 ${stat.colorClass}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stat.value}
                  {stat.percentage && (
                    <span className="text-xs text-muted-foreground ml-1">
                      ({stat.percentage})
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Call List Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Call List</CardTitle>
            <p className="text-sm text-muted-foreground">
              Displaying {callLogs.length} of {paginatedCallsData?.total || 0}{' '}
              total calls
            </p>
          </div>
          <Button variant="outline">
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
          </Button>
        </CardHeader>
        <CardContent className="relative min-h-[200px]">
          {' '}
          {/* Added relative and min-h for loader positioning */}
          {isLoading ? (
            <motion.div
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm p-4 space-y-3" // Adjusted for skeleton layout
            >
              {/* Skeleton Loader for Table Rows */}
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
                onPageChange={setPageIndex}
                onPageSizeChange={setPageSize}
              />
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default VoipDashboardPage

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Search,
  Clock,
  FileText,
  ExternalLink,
  Database,
  Loader2,
} from 'lucide-react'
import { axiosInstance, handleApiError } from '@/api/axios-instance'
import { cn } from '@/lib/utils'

type SearchResult = {
  ticketId: number
  summary: string
  resolution: string | null
  board: string | null
  type: string | null
  subtype: string | null
  item: string | null
  minutesToResolve: number | null
  closedAt: string
  similarity: number
}

type KBStats = {
  totalEntries: number
  syncState: {
    lastSyncAt: string
    totalSynced: number
    lastRunAt: string
  } | null
  boardBreakdown: { board: string; count: number }[]
}

async function searchKB(query: string, limit: number): Promise<{ query: string; count: number; results: SearchResult[] }> {
  const { data } = await axiosInstance.get('/resolution-kb/search', {
    params: { q: query, limit },
  })
  return data
}

async function fetchStats(): Promise<KBStats> {
  const { data } = await axiosInstance.get('/resolution-kb/stats')
  return data
}

function formatMinutes(mins: number | null): string {
  if (mins === null) return 'N/A'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function similarityColor(sim: number): string {
  if (sim >= 0.8) return 'bg-green-500/20 text-green-400 border-green-500/30'
  if (sim >= 0.65) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
  return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
}

export default function KBSearchPage() {
  const [query, setQuery] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const { data: stats } = useQuery({
    queryKey: ['kb-stats'],
    queryFn: fetchStats,
    staleTime: 60_000,
  })

  const {
    data: searchResults,
    isFetching,
    error,
  } = useQuery({
    queryKey: ['kb-search', searchQuery],
    queryFn: () => searchKB(searchQuery, 10),
    enabled: !!searchQuery,
    staleTime: 30_000,
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) setSearchQuery(query.trim())
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Base Search"
        description="Search past resolved tickets for similar issues and resolutions"
      />

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalEntries.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Total entries</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {stats.syncState?.lastRunAt
                      ? new Date(stats.syncState.lastRunAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Never'}
                  </p>
                  <p className="text-xs text-muted-foreground">Last sync</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {stats.boardBreakdown.slice(0, 2).map((b) => (
            <Card key={b.board}>
              <CardContent className="pt-4 pb-4">
                <p className="text-2xl font-bold">{b.count.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground truncate">{b.board}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Resolutions
          </CardTitle>
          <CardDescription>
            Describe the issue to find similar past tickets and how they were resolved
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-3">
            <Input
              placeholder="e.g. webcam not working on Dell laptop, VPN connection timeout..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={!query.trim() || isFetching}>
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Search failed: {handleApiError(error)}</p>
          </CardContent>
        </Card>
      )}

      {searchResults && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {searchResults.count} result{searchResults.count !== 1 ? 's' : ''} for "{searchResults.query}"
          </p>

          {searchResults.results.map((result) => (
            <Card key={result.ticketId} className="hover:border-primary/50 transition-colors">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={cn('text-xs', similarityColor(Number(result.similarity)))}
                      >
                        {(Number(result.similarity) * 100).toFixed(0)}% match
                      </Badge>
                      <span className="text-sm font-medium">{result.summary}</span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {result.board && <span>{result.board}</span>}
                      {result.type && (
                        <>
                          <span>›</span>
                          <span>{result.type}</span>
                        </>
                      )}
                      {result.subtype && (
                        <>
                          <span>›</span>
                          <span>{result.subtype}</span>
                        </>
                      )}
                      {result.item && (
                        <>
                          <span>›</span>
                          <span>{result.item}</span>
                        </>
                      )}
                    </div>

                    {result.resolution && (
                      <div className="mt-2 text-sm text-foreground/80 bg-muted/50 rounded-lg p-3">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                          <FileText className="h-3 w-3" />
                          Resolution
                        </div>
                        <p className="whitespace-pre-wrap">
                          {result.resolution.length > 500
                            ? result.resolution.substring(0, 500) + '...'
                            : result.resolution}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatMinutes(result.minutesToResolve)}
                      </span>
                      <span>
                        Closed {new Date(result.closedAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />
                        Ticket #{result.ticketId}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {searchResults.count === 0 && (
            <Card>
              <CardContent className="pt-6 pb-6 text-center text-muted-foreground">
                No similar resolutions found. Try different keywords or lower the similarity threshold.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

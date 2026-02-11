import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  RefreshCw,
  Settings,
  Play,
  Pause,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { axiosInstance, handleApiError } from '@/api/axios-instance'
import { SyncRunHistory, type SyncRun } from './SyncRunHistory'
import { SyncSettingsModal } from './SyncSettingsModal'
import { cn } from '@/lib/utils'

type MarketingSync = {
  id: string
  name: string
  description: string | null
  sourceType: string
  destType: string
  filterConfig: Record<string, any>
  tagName: string
  schedule: string | null
  enabled: boolean
  createdAt: string
  updatedAt: string
  runs: SyncRun[]
}

const CRON_LABELS: Record<string, string> = {
  '0 6 * * *': 'Daily at 6:00 AM',
  '0 6 * * 1': 'Weekly — Monday 6:00 AM',
  '0 6 * * 5': 'Weekly — Friday 6:00 AM',
  '0 6 1 * *': 'Monthly — 1st at 6:00 AM',
}

function cronToLabel(cron: string | null): string {
  if (!cron) return 'No schedule'
  return CRON_LABELS[cron] ?? cron
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function lastRunSummary(run: SyncRun | undefined): string {
  if (!run) return 'Never run'
  if (run.status === 'running') return 'Running...'
  if (run.status === 'failed') return `Failed: ${run.errorMessage ?? 'Unknown error'}`
  return `${run.contactsTotal} synced, ${run.contactsCreated} new, ${run.contactsRemoved} removed`
}

const MarketingPage = () => {
  const queryClient = useQueryClient()
  const [settingsSync, setSettingsSync] = useState<MarketingSync | null>(null)
  const [expandedSyncId, setExpandedSyncId] = useState<string | null>(null)

  // Fetch all syncs
  const {
    data: syncs,
    isLoading,
    error,
  } = useQuery<MarketingSync[]>({
    queryKey: ['marketing', 'syncs'],
    queryFn: async () => {
      return await axiosInstance<MarketingSync[]>({
        url: '/api/v1/marketing/syncs',
        method: 'GET',
      })
    },
    staleTime: 30_000,
    refetchInterval: 15_000,
  })

  // Fetch run history for expanded sync
  const { data: runsData, isLoading: runsLoading } = useQuery<{
    data: SyncRun[]
    total: number
  }>({
    queryKey: ['marketing', 'syncs', expandedSyncId, 'runs'],
    queryFn: async () => {
      return await axiosInstance({
        url: `/api/v1/marketing/syncs/${expandedSyncId}/runs`,
        method: 'GET',
        params: { limit: 20 },
      })
    },
    enabled: !!expandedSyncId,
    staleTime: 15_000,
  })

  // Trigger sync mutation
  const triggerMutation = useMutation({
    mutationFn: async (syncId: string) => {
      return await axiosInstance({
        url: `/api/v1/marketing/syncs/${syncId}/trigger`,
        method: 'POST',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing'] })
    },
    onError: (err) => handleApiError(err),
  })

  // Update sync mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: { schedule?: string; enabled?: boolean }
    }) => {
      return await axiosInstance({
        url: `/api/v1/marketing/syncs/${id}`,
        method: 'PATCH',
        data,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing'] })
      setSettingsSync(null)
    },
    onError: (err) => handleApiError(err),
  })

  // Toggle enabled/disabled
  const toggleMutation = useMutation({
    mutationFn: async ({
      id,
      enabled,
    }: {
      id: string
      enabled: boolean
    }) => {
      return await axiosInstance({
        url: `/api/v1/marketing/syncs/${id}`,
        method: 'PATCH',
        data: { enabled },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing'] })
    },
    onError: (err) => handleApiError(err),
  })

  if (error) {
    return (
      <div className="space-y-10">
        <PageHeader
          title="Marketing Automations"
          description="Sync contacts from ConnectWise to Encharge email marketing."
        />
        <Card className="border-red-500/30">
          <CardContent className="flex items-center gap-3 py-8">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <p className="text-sm text-red-400">
              Failed to load sync automations. Please try again.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <PageHeader
        title="Marketing Automations"
        description="Sync contacts from ConnectWise to Encharge email marketing."
      />

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-xl border border-border/40 bg-muted/20"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {syncs?.map((sync) => {
            const lastRun = sync.runs?.[0]
            const isExpanded = expandedSyncId === sync.id

            return (
              <Card
                key={sync.id}
                className={cn(
                  'border border-border/80 bg-card/70 backdrop-blur-sm transition-all',
                  'dark:border-[#242F3F]',
                  isExpanded && 'ring-1 ring-[#DEDC00]/30'
                )}
              >
                <CardHeader>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-lg">{sync.name}</CardTitle>
                        <Badge
                          className={cn(
                            'text-xs',
                            sync.enabled
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          )}
                        >
                          {sync.enabled ? 'Active' : 'Paused'}
                        </Badge>
                      </div>
                      {sync.description && (
                        <CardDescription>{sync.description}</CardDescription>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="bg-[#DEDC00] text-[#1C2533] hover:bg-[#F8AB08]"
                        onClick={() => triggerMutation.mutate(sync.id)}
                        disabled={triggerMutation.isPending}
                      >
                        <RefreshCw
                          className={cn(
                            'mr-1.5 h-4 w-4',
                            triggerMutation.isPending && 'animate-spin'
                          )}
                        />
                        Sync Now
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          toggleMutation.mutate({
                            id: sync.id,
                            enabled: !sync.enabled,
                          })
                        }
                        disabled={toggleMutation.isPending}
                      >
                        {sync.enabled ? (
                          <>
                            <Pause className="mr-1.5 h-4 w-4" /> Pause
                          </>
                        ) : (
                          <>
                            <Play className="mr-1.5 h-4 w-4" /> Resume
                          </>
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setSettingsSync(sync)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Stats row */}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      Schedule: {cronToLabel(sync.schedule)}
                    </span>
                    {lastRun && (
                      <span>
                        Last run:{' '}
                        <span
                          className={cn(
                            lastRun.status === 'failed' && 'text-red-400'
                          )}
                        >
                          {lastRunSummary(lastRun)}
                        </span>
                        <span className="ml-1 text-xs opacity-60">
                          ({formatRelativeTime(lastRun.startedAt)})
                        </span>
                      </span>
                    )}
                    {!lastRun && <span>Last run: Never</span>}
                  </div>

                  {/* Expand toggle for run history */}
                  <div className="border-t border-border/50 pt-3">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedSyncId(isExpanded ? null : sync.id)
                      }
                      className="text-sm font-medium text-[#DEDC00] hover:text-[#F8AB08] transition-colors"
                    >
                      {isExpanded ? 'Hide run history' : 'Show run history'}
                    </button>

                    {isExpanded && (
                      <div className="mt-4">
                        <SyncRunHistory
                          runs={runsData?.data ?? sync.runs}
                          isLoading={runsLoading}
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {syncs?.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  No sync automations configured yet.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Settings modal */}
      {settingsSync && (
        <SyncSettingsModal
          isOpen={!!settingsSync}
          onClose={() => setSettingsSync(null)}
          sync={settingsSync}
          onSave={(data) =>
            updateMutation.mutate({ id: settingsSync.id, data })
          }
          isSaving={updateMutation.isPending}
        />
      )}
    </div>
  )
}

export default MarketingPage

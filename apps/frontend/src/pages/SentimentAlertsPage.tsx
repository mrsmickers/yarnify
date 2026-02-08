import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { axiosInstance, handleApiError } from '@/api/axios-instance'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  Loader2,
  Settings,
  ShieldAlert,
  X,
  XCircle,
} from 'lucide-react'
import { Link } from 'react-router-dom'

// ── Types ───────────────────────────────────────────────────────────────

type SentimentAlert = {
  id: string
  callId: string
  callAnalysisId: string
  configId: string | null
  alertType: string
  severity: string
  sentiment: string | null
  frustration: string | null
  reviewedAt: string | null
  reviewedBy: string | null
  reviewNotes: string | null
  dismissedAt: string | null
  createdAt: string
  call: {
    id: string
    startTime: string
    callDirection: string | null
    externalPhoneNumber: string | null
    company: { id: string; name: string } | null
    Agents: { id: string; name: string } | null
  }
}

type AlertStats = {
  totalPending: number
  reviewedToday: number
  criticalPending: number
}

type SentimentAlertConfig = {
  id: string
  name: string
  isActive: boolean
  sentimentValues: string[]
  frustrationMin: string | null
  flagForReview: boolean
  notifyEmails: string[]
  createdAt: string
  updatedAt: string
}

// ── Severity / Type Styling ─────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

const ALERT_TYPE_LABELS: Record<string, string> = {
  negative_sentiment: 'Negative Sentiment',
  high_frustration: 'High Frustration',
  manual: 'Manual',
}

// ── Main Page ───────────────────────────────────────────────────────────

export default function SentimentAlertsPage() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('pending')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [reviewDialogAlert, setReviewDialogAlert] = useState<SentimentAlert | null>(null)
  const [showConfigPanel, setShowConfigPanel] = useState(false)

  // Fetch alerts
  const { data: alertsResponse, isLoading: alertsLoading } = useQuery({
    queryKey: ['admin', 'sentiment-alerts', statusFilter, severityFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (severityFilter !== 'all') params.set('severity', severityFilter)
      params.set('page', String(page))
      params.set('limit', '20')
      return await axiosInstance<{
        data: SentimentAlert[]
        total: number
        page: number
        limit: number
        totalPages: number
      }>({
        url: `/api/v1/admin/sentiment-alerts?${params.toString()}`,
        method: 'GET',
      })
    },
  })

  // Fetch stats
  const { data: stats } = useQuery<AlertStats>({
    queryKey: ['admin', 'sentiment-alerts', 'stats'],
    queryFn: async () => {
      return await axiosInstance({
        url: '/api/v1/admin/sentiment-alerts/stats',
        method: 'GET',
      })
    },
  })

  // Dismiss mutation
  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      return await axiosInstance({
        url: `/api/v1/admin/sentiment-alerts/${id}/dismiss`,
        method: 'PATCH',
        data: { dismissedBy: 'admin' },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'sentiment-alerts'] })
    },
  })

  // Review mutation
  const reviewMutation = useMutation({
    mutationFn: async (data: { id: string; reviewNotes: string }) => {
      return await axiosInstance({
        url: `/api/v1/admin/sentiment-alerts/${data.id}/review`,
        method: 'PATCH',
        data: { reviewedBy: 'admin', reviewNotes: data.reviewNotes },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'sentiment-alerts'] })
      setReviewDialogAlert(null)
    },
  })

  const handleDismiss = (alert: SentimentAlert) => {
    const promise = dismissMutation.mutateAsync(alert.id)
    toast.promise(promise, {
      loading: 'Dismissing alert...',
      success: 'Alert dismissed',
      error: (err) => handleApiError(err),
    })
  }

  const handleReviewSubmit = (notes: string) => {
    if (!reviewDialogAlert) return
    const promise = reviewMutation.mutateAsync({
      id: reviewDialogAlert.id,
      reviewNotes: notes,
    })
    toast.promise(promise, {
      loading: 'Marking as reviewed...',
      success: 'Alert marked as reviewed',
      error: (err) => handleApiError(err),
    })
  }

  const alerts = alertsResponse?.data ?? []
  const totalPages = alertsResponse?.totalPages ?? 1

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sentiment Alerts"
        description="Review flagged calls with negative sentiment or high frustration levels."
        actions={
          <Button
            variant="outline"
            onClick={() => setShowConfigPanel(!showConfigPanel)}
          >
            <Settings className="mr-2 h-4 w-4" />
            {showConfigPanel ? 'Hide Config' : 'Alert Config'}
          </Button>
        }
      />

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
          <CardContent className="flex items-center gap-4 pt-6">
            <Clock className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold">{stats?.totalPending ?? 0}</p>
              <p className="text-sm text-muted-foreground">Pending Review</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
          <CardContent className="flex items-center gap-4 pt-6">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{stats?.reviewedToday ?? 0}</p>
              <p className="text-sm text-muted-foreground">Reviewed Today</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
          <CardContent className="flex items-center gap-4 pt-6">
            <ShieldAlert className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{stats?.criticalPending ?? 0}</p>
              <p className="text-sm text-muted-foreground">Critical Pending</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Config panel (collapsible) */}
      {showConfigPanel && <AlertConfigPanel />}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setPage(1) }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alerts table */}
      <Card className="border border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Alert Queue
          </CardTitle>
          <CardDescription>
            Calls flagged by sentiment analysis for manual review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alertsLoading ? (
            <div className="flex h-[200px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="h-12 w-12 text-green-500/40" />
              <h3 className="mt-4 text-lg font-semibold">All clear</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                No alerts match your current filters.
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Sentiment</TableHead>
                    <TableHead>Frustration</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map((alert) => (
                    <TableRow key={alert.id}>
                      <TableCell className="text-sm">
                        {new Date(alert.call.startTime).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {new Date(alert.call.startTime).toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </TableCell>
                      <TableCell>
                        {alert.call.Agents?.name || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        {alert.call.company?.name || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            alert.sentiment === 'Negative' || alert.sentiment === 'Very Negative'
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : ''
                          }
                        >
                          {alert.sentiment || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            alert.frustration === 'High'
                              ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                              : ''
                          }
                        >
                          {alert.frustration || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {ALERT_TYPE_LABELS[alert.alertType] || alert.alertType}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            SEVERITY_STYLES[alert.severity] || ''
                          }
                        >
                          {alert.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {alert.dismissedAt ? (
                          <Badge variant="outline" className="bg-zinc-500/10 text-zinc-400 border-zinc-500/20">
                            Dismissed
                          </Badge>
                        ) : alert.reviewedAt ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">
                            Reviewed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/calls/${alert.callId}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          {!alert.reviewedAt && !alert.dismissedAt && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setReviewDialogAlert(alert)}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDismiss(alert)}
                                disabled={dismissMutation.isPending}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} ({alertsResponse?.total ?? 0} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Review dialog */}
      {reviewDialogAlert && (
        <ReviewDialog
          alert={reviewDialogAlert}
          open={!!reviewDialogAlert}
          onClose={() => setReviewDialogAlert(null)}
          onSubmit={handleReviewSubmit}
          isSubmitting={reviewMutation.isPending}
        />
      )}
    </div>
  )
}

// ── Review Dialog ───────────────────────────────────────────────────────

function ReviewDialog({
  alert,
  open,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  alert: SentimentAlert
  open: boolean
  onClose: () => void
  onSubmit: (notes: string) => void
  isSubmitting: boolean
}) {
  const [notes, setNotes] = useState('')

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Review Alert</DialogTitle>
          <DialogDescription>
            Mark this alert as reviewed. Add optional notes about your findings.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Call</span>
              <Link
                to={`/calls/${alert.callId}`}
                className="text-[#DEDC00] hover:text-[#F8AB08]"
              >
                View call →
              </Link>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sentiment</span>
              <span className="font-medium">{alert.sentiment || 'N/A'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Frustration</span>
              <span className="font-medium">{alert.frustration || 'N/A'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Severity</span>
              <Badge
                variant="outline"
                className={SEVERITY_STYLES[alert.severity] || ''}
              >
                {alert.severity}
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reviewNotes">Review Notes (optional)</Label>
            <Textarea
              id="reviewNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this alert..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => onSubmit(notes)}
              disabled={isSubmitting}
              className="bg-[#DEDC00] text-[#1C2533] hover:bg-[#F8AB08]"
            >
              {isSubmitting ? 'Saving...' : 'Mark as Reviewed'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Alert Config Panel ──────────────────────────────────────────────────

function AlertConfigPanel() {
  const queryClient = useQueryClient()
  const [editingConfig, setEditingConfig] = useState<SentimentAlertConfig | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const { data: configs = [], isLoading } = useQuery<SentimentAlertConfig[]>({
    queryKey: ['admin', 'sentiment-alerts', 'configs'],
    queryFn: async () => {
      return await axiosInstance({
        url: '/api/v1/admin/sentiment-alerts/configs',
        method: 'GET',
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await axiosInstance({
        url: `/api/v1/admin/sentiment-alerts/configs/${id}`,
        method: 'DELETE',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'sentiment-alerts', 'configs'] })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await axiosInstance({
        url: `/api/v1/admin/sentiment-alerts/configs/${id}`,
        method: 'PATCH',
        data: { isActive },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'sentiment-alerts', 'configs'] })
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (data: { id?: string; payload: Record<string, unknown> }) => {
      if (data.id) {
        return await axiosInstance({
          url: `/api/v1/admin/sentiment-alerts/configs/${data.id}`,
          method: 'PATCH',
          data: data.payload,
        })
      } else {
        return await axiosInstance({
          url: '/api/v1/admin/sentiment-alerts/configs',
          method: 'POST',
          data: data.payload,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'sentiment-alerts', 'configs'] })
      setEditingConfig(null)
      setIsCreateOpen(false)
    },
  })

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Delete "${name}"?`)) {
      const promise = deleteMutation.mutateAsync(id)
      toast.promise(promise, {
        loading: 'Deleting...',
        success: 'Config deleted',
        error: (err) => handleApiError(err),
      })
    }
  }

  const handleToggle = (config: SentimentAlertConfig) => {
    const promise = toggleMutation.mutateAsync({
      id: config.id,
      isActive: !config.isActive,
    })
    toast.promise(promise, {
      loading: config.isActive ? 'Deactivating...' : 'Activating...',
      success: config.isActive ? 'Config deactivated' : 'Config activated',
      error: (err) => handleApiError(err),
    })
  }

  return (
    <Card className="border border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Alert Configurations
            </CardTitle>
            <CardDescription className="mt-1">
              Define which sentiment values and frustration levels trigger alerts.
            </CardDescription>
          </div>
          <Button
            onClick={() => { setEditingConfig(null); setIsCreateOpen(true) }}
            className="bg-[#DEDC00] text-[#1C2533] hover:bg-[#F8AB08]"
            size="sm"
          >
            Add Config
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-[100px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : configs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No alert configurations yet. Create one to start monitoring.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Sentiment Triggers</TableHead>
                <TableHead>Min Frustration</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.map((config) => (
                <TableRow key={config.id}>
                  <TableCell className="font-medium">{config.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {config.sentimentValues.length > 0
                        ? config.sentimentValues.map((v) => (
                            <Badge key={v} variant="outline" className="text-xs">
                              {v}
                            </Badge>
                          ))
                        : <span className="text-muted-foreground text-xs">None</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {config.frustrationMin ? (
                      <Badge variant="outline">{config.frustrationMin}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">None</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleToggle(config)}
                      disabled={toggleMutation.isPending}
                    >
                      {config.isActive ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setEditingConfig(config); setIsCreateOpen(true) }}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(config.id, config.name)}
                        disabled={deleteMutation.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {isCreateOpen && (
        <ConfigDialog
          config={editingConfig}
          open={isCreateOpen}
          onClose={() => { setIsCreateOpen(false); setEditingConfig(null) }}
          onSubmit={(payload) => {
            const promise = saveMutation.mutateAsync({
              id: editingConfig?.id,
              payload,
            })
            toast.promise(promise, {
              loading: editingConfig ? 'Updating...' : 'Creating...',
              success: editingConfig ? 'Config updated' : 'Config created',
              error: (err) => handleApiError(err),
            })
            return promise
          }}
        />
      )}
    </Card>
  )
}

// ── Config Dialog ───────────────────────────────────────────────────────

const SENTIMENT_OPTIONS = ['Positive', 'Neutral', 'Negative', 'Very Negative', 'Undetermined']
const FRUSTRATION_OPTIONS = [
  { value: 'none', label: 'None (disabled)' },
  { value: 'Low', label: 'Low' },
  { value: 'Medium', label: 'Medium' },
  { value: 'High', label: 'High' },
]

function ConfigDialog({
  config,
  open,
  onClose,
  onSubmit,
}: {
  config: SentimentAlertConfig | null
  open: boolean
  onClose: () => void
  onSubmit: (payload: Record<string, unknown>) => Promise<unknown>
}) {
  const [name, setName] = useState(config?.name || '')
  const [sentimentValues, setSentimentValues] = useState<string[]>(
    config?.sentimentValues || ['Negative', 'Very Negative'],
  )
  const [frustrationMin, setFrustrationMin] = useState(config?.frustrationMin || 'none')
  const [isActive, setIsActive] = useState(config?.isActive ?? true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const toggleSentiment = (val: string) => {
    setSentimentValues((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val],
    )
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    setIsSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        sentimentValues,
        frustrationMin: frustrationMin === 'none' ? null : frustrationMin,
        isActive,
        flagForReview: true,
        notifyEmails: [],
      })
      onClose()
    } catch {
      // toast already shown by caller
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{config ? 'Edit Alert Config' : 'Create Alert Config'}</DialogTitle>
          <DialogDescription>
            Define which call analysis results should trigger a sentiment alert.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="config-name">Name *</Label>
            <Input
              id="config-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Negative Sentiment Alert"
            />
          </div>

          <div className="space-y-2">
            <Label>Sentiment Triggers</Label>
            <p className="text-xs text-muted-foreground">
              Select which sentiment values should trigger this alert.
            </p>
            <div className="flex flex-wrap gap-2 mt-1">
              {SENTIMENT_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleSentiment(opt)}
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    sentimentValues.includes(opt)
                      ? 'border-[#DEDC00] bg-[#DEDC00]/10 text-[#DEDC00]'
                      : 'border-border text-muted-foreground hover:border-muted-foreground'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="frustrationMin">Minimum Frustration Level</Label>
            <Select value={frustrationMin} onValueChange={setFrustrationMin}>
              <SelectTrigger id="frustrationMin">
                <SelectValue placeholder="None (disabled)" />
              </SelectTrigger>
              <SelectContent>
                {FRUSTRATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Alerts trigger when frustration is at or above this level.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="config-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="config-active" className="cursor-pointer">
              Active
            </Label>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-[#DEDC00] text-[#1C2533] hover:bg-[#F8AB08]"
            >
              {isSubmitting ? 'Saving...' : config ? 'Update Config' : 'Create Config'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

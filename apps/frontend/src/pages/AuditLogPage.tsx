import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { axiosInstance } from '@/api/axios-instance'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  ScrollText,
  Loader2,
  Search,
  Eye,
  Calendar,
  User,
  Settings,
  Shield,
  Phone,
  LogIn,
  LogOut,
} from 'lucide-react'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'

type AuditLog = {
  id: string
  timestamp: string
  actorId: string | null
  actorEmail: string | null
  action: string
  targetType: string | null
  targetId: string | null
  targetName: string | null
  metadata: Record<string, unknown> | null
  actor?: {
    id: string
    email: string
    displayName: string | null
  } | null
}

type AuditLogsResponse = {
  data: AuditLog[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const ACTION_CATEGORIES: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  'auth.login': { label: 'Login', color: 'bg-green-500/10 text-green-400 border-green-500/20', icon: LogIn },
  'auth.logout': { label: 'Logout', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20', icon: LogOut },
  'auth.impersonate.start': { label: 'Impersonate', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: User },
  'call.view': { label: 'View Call', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Phone },
  'permission.role.update': { label: 'Role Permissions', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: Shield },
  'permission.user.override': { label: 'User Permission', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: Shield },
  'config.prompt.update': { label: 'Prompt Update', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', icon: Settings },
  'config.training_rule.create': { label: 'Rule Created', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: Settings },
  'config.training_rule.update': { label: 'Rule Updated', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', icon: Settings },
  'config.training_rule.delete': { label: 'Rule Deleted', color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: Settings },
  'config.scoring.update': { label: 'Scoring Update', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', icon: Settings },
  'config.alert.update': { label: 'Alert Config', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', icon: Settings },
  'user.role.update': { label: 'Role Changed', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: User },
}

const TARGET_TYPES = [
  { value: '', label: 'All Targets' },
  { value: 'user', label: 'User' },
  { value: 'call', label: 'Call' },
  { value: 'role', label: 'Role' },
  { value: 'prompt', label: 'Prompt' },
  { value: 'training_rule', label: 'Training Rule' },
  { value: 'scoring', label: 'Scoring' },
  { value: 'alert_config', label: 'Alert Config' },
]

const DATE_RANGES = [
  { value: '1', label: 'Last 24 hours' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
]

function getActionDisplay(action: string) {
  const category = ACTION_CATEGORIES[action]
  if (category) return category
  
  // Default for unknown actions
  return {
    label: action.split('.').pop() || action,
    color: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    icon: Settings,
  }
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [dateRange, setDateRange] = useState('7')
  const [targetType, setTargetType] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [actorSearch, setActorSearch] = useState('')
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  // Calculate date filters
  const getDateFilters = () => {
    if (dateRange === 'all') return {}
    const days = parseInt(dateRange, 10)
    const startDate = startOfDay(subDays(new Date(), days))
    const endDate = endOfDay(new Date())
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    }
  }

  // Fetch audit logs
  const { data: logsData, isLoading, error } = useQuery<AuditLogsResponse>({
    queryKey: ['admin', 'audit', page, limit, dateRange, targetType, actionFilter, actorSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      })
      
      const dateFilters = getDateFilters()
      if (dateFilters.startDate) params.append('startDate', dateFilters.startDate)
      if (dateFilters.endDate) params.append('endDate', dateFilters.endDate)
      if (targetType) params.append('targetType', targetType)
      if (actionFilter) params.append('action', actionFilter)
      
      return await axiosInstance({
        url: `/api/v1/admin/audit?${params.toString()}`,
        method: 'GET',
      })
    },
    staleTime: 30000, // Cache for 30 seconds
  })

  // Filter logs client-side for actor search (API could support this too)
  const filteredLogs = (logsData?.data || []).filter((log) => {
    if (!actorSearch) return true
    const searchLower = actorSearch.toLowerCase()
    return (
      log.actorEmail?.toLowerCase().includes(searchLower) ||
      log.actor?.displayName?.toLowerCase().includes(searchLower)
    )
  })

  const renderPagination = () => {
    if (!logsData || logsData.totalPages <= 1) return null

    const pages: (number | 'ellipsis')[] = []
    const totalPages = logsData.totalPages
    const current = page

    // Always show first page
    pages.push(1)

    // Show ellipsis if current is far from start
    if (current > 3) pages.push('ellipsis')

    // Show pages around current
    for (let i = Math.max(2, current - 1); i <= Math.min(totalPages - 1, current + 1); i++) {
      if (!pages.includes(i)) pages.push(i)
    }

    // Show ellipsis if current is far from end
    if (current < totalPages - 2) pages.push('ellipsis')

    // Always show last page
    if (totalPages > 1 && !pages.includes(totalPages)) pages.push(totalPages)

    return (
      <Pagination className="mt-4">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
            />
          </PaginationItem>
          {pages.map((p, idx) =>
            p === 'ellipsis' ? (
              <PaginationItem key={`ellipsis-${idx}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={p}>
                <PaginationLink
                  onClick={() => setPage(p)}
                  isActive={page === p}
                  className="cursor-pointer"
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            )
          )}
          <PaginationItem>
            <PaginationNext
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className={page === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="View all user actions and system events for compliance and troubleshooting."
        icon={<ScrollText className="h-6 w-6" />}
      />

      {/* Filters */}
      <Card className="border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Date Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                <Calendar className="mr-1 inline h-4 w-4" />
                Date Range
              </label>
              <Select value={dateRange} onValueChange={(v) => { setDateRange(v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGES.map((range) => (
                    <SelectItem key={range.value} value={range.value}>
                      {range.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Target Type
              </label>
              <Select value={targetType} onValueChange={(v) => { setTargetType(v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="All Targets" />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Action Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Action
              </label>
              <Input
                placeholder="Filter by action..."
                value={actionFilter}
                onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              />
            </div>

            {/* Actor Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                <Search className="mr-1 inline h-4 w-4" />
                Actor
              </label>
              <Input
                placeholder="Search by email or name..."
                value={actorSearch}
                onChange={(e) => setActorSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-[#DEDC00]" />
            Activity Log
          </CardTitle>
          <CardDescription>
            {logsData ? `${logsData.total.toLocaleString()} events found` : 'Loading...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="rounded-lg bg-red-500/10 p-4 text-red-400">
              Failed to load audit logs. Please try again.
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No audit events found matching your filters.
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Timestamp</TableHead>
                      <TableHead className="w-[200px]">Actor</TableHead>
                      <TableHead className="w-[160px]">Action</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead className="w-[80px] text-right">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => {
                      const actionDisplay = getActionDisplay(log.action)
                      const ActionIcon = actionDisplay.icon
                      
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {format(new Date(log.timestamp), 'MMM d, yyyy HH:mm:ss')}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm">
                                {log.actor?.displayName || log.actorEmail || 'System'}
                              </span>
                              {log.actor?.displayName && log.actorEmail && (
                                <span className="text-xs text-muted-foreground">
                                  {log.actorEmail}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`${actionDisplay.color} gap-1`}
                            >
                              <ActionIcon className="h-3 w-3" />
                              {actionDisplay.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm">
                                {log.targetName || log.targetId || '—'}
                              </span>
                              {log.targetType && (
                                <span className="text-xs text-muted-foreground">
                                  {log.targetType}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedLog(log)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              {renderPagination()}
            </>
          )}
        </CardContent>
      </Card>

      {/* Details Modal */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Audit Log Details
            </DialogTitle>
            <DialogDescription>
              Full details of the selected event
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="font-medium text-muted-foreground">Timestamp</label>
                  <p>{format(new Date(selectedLog.timestamp), 'PPpp')}</p>
                </div>
                <div>
                  <label className="font-medium text-muted-foreground">Action</label>
                  <p>
                    <Badge
                      variant="outline"
                      className={getActionDisplay(selectedLog.action).color}
                    >
                      {selectedLog.action}
                    </Badge>
                  </p>
                </div>
                <div>
                  <label className="font-medium text-muted-foreground">Actor</label>
                  <p>{selectedLog.actor?.displayName || selectedLog.actorEmail || 'System'}</p>
                  {selectedLog.actorEmail && selectedLog.actor?.displayName && (
                    <p className="text-xs text-muted-foreground">{selectedLog.actorEmail}</p>
                  )}
                </div>
                <div>
                  <label className="font-medium text-muted-foreground">Target</label>
                  <p>{selectedLog.targetName || selectedLog.targetId || '—'}</p>
                  {selectedLog.targetType && (
                    <p className="text-xs text-muted-foreground">
                      Type: {selectedLog.targetType}
                    </p>
                  )}
                </div>
              </div>
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <label className="font-medium text-muted-foreground">Metadata</label>
                  <pre className="mt-2 max-h-[300px] overflow-auto rounded-lg bg-muted p-4 text-xs">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

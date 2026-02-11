import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type SyncRun = {
  id: string
  syncId: string
  status: string
  triggeredBy: string
  startedAt: string
  completedAt: string | null
  contactsTotal: number
  contactsCreated: number
  contactsUpdated: number
  contactsRemoved: number
  contactsSkipped: number
  contactsFailed: number
  errorMessage: string | null
}

type SyncRunHistoryProps = {
  runs: SyncRun[]
  isLoading?: boolean
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return 'Running...'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusBadge(status: string) {
  switch (status) {
    case 'completed':
      return (
        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
          Completed
        </Badge>
      )
    case 'running':
      return (
        <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30">
          Running
        </Badge>
      )
    case 'failed':
      return (
        <Badge className="bg-red-500/15 text-red-400 border-red-500/30">
          Failed
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export function SyncRunHistory({ runs, isLoading }: SyncRunHistoryProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded-md bg-muted/40"
          />
        ))}
      </div>
    )
  }

  if (!runs || runs.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No sync runs yet. Trigger a sync to see results here.
      </p>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Trigger</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead className="text-right">Created</TableHead>
            <TableHead className="text-right">Updated</TableHead>
            <TableHead className="text-right">Removed</TableHead>
            <TableHead className="text-right">Skipped</TableHead>
            <TableHead className="text-right">Failed</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow key={run.id}>
              <TableCell className="whitespace-nowrap text-sm">
                {formatDate(run.startedAt)}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs capitalize',
                    run.triggeredBy === 'manual'
                      ? 'border-[#DEDC00]/40 text-[#DEDC00]'
                      : 'border-blue-500/40 text-blue-400'
                  )}
                >
                  {run.triggeredBy}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {formatDuration(run.startedAt, run.completedAt)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {run.contactsCreated}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {run.contactsUpdated}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {run.contactsRemoved}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {run.contactsSkipped}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {run.contactsFailed > 0 ? (
                  <span className="text-red-400">{run.contactsFailed}</span>
                ) : (
                  run.contactsFailed
                )}
              </TableCell>
              <TableCell>{statusBadge(run.status)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

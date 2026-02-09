import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Search, Send, Sparkles, X, Ticket } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { axiosInstance, handleApiError } from '@/api/axios-instance'

interface CWTicket {
  id: number
  summary: string
  board?: { id: number; name: string }
  status?: { id: number; name: string }
  company?: { id: number; identifier: string; name: string }
  dateEntered?: string
  lastUpdated?: string
  closedFlag?: boolean
  priority?: { id: number; name: string }
}

interface AddToTicketModalProps {
  isOpen: boolean
  onClose: () => void
  callId: string
  initialNotes: string
  companyName?: string
}

type RewriteStyle = 'formal' | 'concise' | 'detailed' | 'technical'

const REWRITE_STYLES: { value: RewriteStyle; label: string; description: string }[] = [
  { value: 'formal', label: 'Formal', description: 'Professional business tone' },
  { value: 'concise', label: 'Concise', description: 'Brief and to the point' },
  { value: 'detailed', label: 'Detailed', description: 'Expanded with context' },
  { value: 'technical', label: 'Technical', description: 'IT service desk style' },
]

export function AddToTicketModal({
  isOpen,
  onClose,
  callId,
  initialNotes,
  companyName,
}: AddToTicketModalProps) {
  const [notes, setNotes] = useState(initialNotes)
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setNotes(initialNotes)
      setSelectedTicketId(null)
      setSearchQuery('')
    }
  }, [isOpen, initialNotes])

  // Fetch tickets for the company
  const {
    data: companyTickets = [],
    isLoading: ticketsLoading,
    refetch: refetchTickets,
  } = useQuery<CWTicket[]>({
    queryKey: ['cw-tickets', companyName],
    queryFn: async () => {
      if (!companyName) return []
      return await axiosInstance({
        url: `/api/v1/connectwise/tickets`,
        method: 'GET',
        params: { companyName, limit: 20 },
      })
    },
    enabled: isOpen && !!companyName,
    staleTime: 30000,
  })

  // Search tickets
  const searchTicketsMutation = useMutation({
    mutationFn: async (query: string) => {
      setIsSearching(true)
      try {
        return await axiosInstance<CWTicket[]>({
          url: `/api/v1/connectwise/tickets`,
          method: 'GET',
          params: { summary: query, limit: 20 },
        })
      } finally {
        setIsSearching(false)
      }
    },
  })

  // AI rewrite mutation
  const rewriteMutation = useMutation({
    mutationFn: async (style: RewriteStyle) => {
      return await axiosInstance<{ rewrittenText: string }>({
        url: `/api/v1/ai/rewrite`,
        method: 'POST',
        data: { text: notes, style },
      })
    },
    onSuccess: (data) => {
      setNotes(data.rewrittenText)
      toast.success('Notes rewritten successfully')
    },
    onError: (error) => {
      toast.error('Failed to rewrite notes: ' + handleApiError(error))
    },
  })

  // Push to ticket mutation
  const pushMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTicketId) throw new Error('No ticket selected')
      return await axiosInstance<{ success: boolean; noteId: number }>({
        url: `/api/v1/connectwise/tickets/${selectedTicketId}/notes`,
        method: 'POST',
        data: { text: notes, internalOnly: true },
      })
    },
    onSuccess: (data) => {
      toast.success(`Note added to ticket #${selectedTicketId}`)
      onClose()
    },
    onError: (error) => {
      toast.error('Failed to add note: ' + handleApiError(error))
    },
  })

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchTicketsMutation.mutate(searchQuery.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch()
    }
  }

  const displayTickets = searchTicketsMutation.data || companyTickets

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            Add Call Notes to Ticket
          </DialogTitle>
          <DialogDescription>
            Edit your call notes and select a ConnectWise ticket to push them to.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
          {/* Left Panel - Notes */}
          <div className="flex flex-col space-y-3 min-h-0">
            <Label htmlFor="notes" className="text-sm font-medium">
              Call Notes
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter notes to add to the ticket..."
              className="flex-1 min-h-[200px] resize-none"
            />

            {/* AI Rewrite buttons */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                AI Rewrite
              </Label>
              <div className="flex flex-wrap gap-2">
                {REWRITE_STYLES.map((style) => (
                  <Button
                    key={style.value}
                    variant="outline"
                    size="sm"
                    onClick={() => rewriteMutation.mutate(style.value)}
                    disabled={rewriteMutation.isPending || !notes.trim()}
                    title={style.description}
                  >
                    {rewriteMutation.isPending &&
                    rewriteMutation.variables === style.value ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : null}
                    {style.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel - Ticket Selection */}
          <div className="flex flex-col space-y-3 min-h-0">
            <Label className="text-sm font-medium">Select Ticket</Label>

            {companyName && (
              <p className="text-xs text-muted-foreground">
                Showing open tickets for: <span className="font-medium">{companyName}</span>
              </p>
            )}

            {/* Search box */}
            <div className="flex gap-2">
              <Input
                placeholder="Search tickets by summary..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Ticket list */}
            <div className="flex-1 overflow-y-auto border rounded-md min-h-[200px] max-h-[300px]">
              {ticketsLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Loading tickets...
                </div>
              ) : displayTickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
                  <Ticket className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No tickets found</p>
                  <p className="text-xs">Try searching for a different term</p>
                </div>
              ) : (
                <div className="divide-y">
                  {displayTickets.map((ticket) => (
                    <label
                      key={ticket.id}
                      className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedTicketId === ticket.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="ticket"
                        value={ticket.id}
                        checked={selectedTicketId === ticket.id}
                        onChange={() => setSelectedTicketId(ticket.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-muted-foreground">
                            #{ticket.id}
                          </span>
                          {ticket.status && (
                            <Badge variant="outline" className="text-xs">
                              {ticket.status.name}
                            </Badge>
                          )}
                          {ticket.board && (
                            <Badge variant="secondary" className="text-xs">
                              {ticket.board.name}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium truncate mt-1">
                          {ticket.summary}
                        </p>
                        {ticket.company && (
                          <p className="text-xs text-muted-foreground truncate">
                            {ticket.company.name}
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => pushMutation.mutate()}
            disabled={!selectedTicketId || !notes.trim() || pushMutation.isPending}
            className="bg-[#DEDC00] text-[#1C2533] hover:bg-[#F8AB08]"
          >
            {pushMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Pushing...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Push to Ticket
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

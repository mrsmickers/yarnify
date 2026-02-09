import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, X, Search, Users, UserCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { axiosInstance, handleApiError } from '@/api/axios-instance'

type Agent = {
  id: string
  name: string
  extension: string | null
}

type UserAgentAccessResponse = {
  userId: string
  ownAgent: Agent | null
  grantedAgents: Agent[]
  grantedAgentIds: string[]
}

type AgentListItem = {
  id: string
  name: string
}

type AgentAccessModalProps = {
  open: boolean
  userId: string
  userName: string
  userRole: string
  onClose: () => void
}

const fetchUserAgentAccess = async (userId: string): Promise<UserAgentAccessResponse> => {
  return axiosInstance<UserAgentAccessResponse>({
    url: `/api/v1/admin/agent-access/users/${userId}`,
    method: 'GET',
  })
}

const fetchAllAgents = async (): Promise<AgentListItem[]> => {
  return axiosInstance<AgentListItem[]>({
    url: '/api/v1/calls/agents',
    method: 'GET',
  })
}

const AgentAccessModal = ({
  open,
  userId,
  userName,
  userRole,
  onClose,
}: AgentAccessModalProps) => {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(new Set())
  const [initialAgentIds, setInitialAgentIds] = useState<Set<string>>(new Set())

  // Fetch user's current agent access
  const {
    data: accessData,
    isLoading: accessLoading,
    isError: accessError,
  } = useQuery<UserAgentAccessResponse, Error>({
    queryKey: ['user-agent-access', userId],
    queryFn: () => fetchUserAgentAccess(userId),
    enabled: open,
    staleTime: 0,
  })

  // Fetch all agents
  const {
    data: allAgents = [],
    isLoading: agentsLoading,
  } = useQuery<AgentListItem[], Error>({
    queryKey: ['all-agents'],
    queryFn: fetchAllAgents,
    enabled: open,
    staleTime: 60_000,
  })

  // Initialize selected agents when data loads
  useEffect(() => {
    if (accessData) {
      const granted = new Set(accessData.grantedAgentIds)
      setSelectedAgentIds(granted)
      setInitialAgentIds(granted)
    }
  }, [accessData])

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSearchTerm('')
    }
  }, [open])

  // Save mutation
  const saveMutation = useMutation<
    { success: boolean; message: string },
    Error,
    string[]
  >({
    mutationFn: (agentIds) =>
      axiosInstance({
        url: `/api/v1/admin/agent-access/users/${userId}`,
        method: 'PUT',
        data: { agentIds },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-agent-access', userId] })
      toast.success(`Agent access updated for ${userName}`)
      onClose()
    },
    onError: (error) => {
      toast.error(handleApiError(error))
    },
  })

  const handleSave = () => {
    saveMutation.mutate(Array.from(selectedAgentIds))
  }

  const handleToggleAgent = (agentId: string) => {
    setSelectedAgentIds((prev) => {
      const next = new Set(prev)
      if (next.has(agentId)) {
        next.delete(agentId)
      } else {
        next.add(agentId)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    const filteredAgents = allAgents.filter((agent) =>
      agent.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    const filteredIds = filteredAgents.map((a) => a.id)
    setSelectedAgentIds((prev) => {
      const next = new Set(prev)
      for (const id of filteredIds) {
        // Don't add own agent
        if (id !== accessData?.ownAgent?.id) {
          next.add(id)
        }
      }
      return next
    })
  }

  const handleDeselectAll = () => {
    const filteredAgents = allAgents.filter((agent) =>
      agent.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    const filteredIds = new Set(filteredAgents.map((a) => a.id))
    setSelectedAgentIds((prev) => {
      const next = new Set(prev)
      for (const id of filteredIds) {
        next.delete(id)
      }
      return next
    })
  }

  const hasChanges = (() => {
    if (selectedAgentIds.size !== initialAgentIds.size) return true
    for (const id of selectedAgentIds) {
      if (!initialAgentIds.has(id)) return true
    }
    return false
  })()

  // Filter agents by search term
  const filteredAgents = allAgents.filter((agent) =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Separate own agent from others
  const ownAgentId = accessData?.ownAgent?.id

  if (!open) return null

  const isLoading = accessLoading || agentsLoading

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-border bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-foreground">
              Agent Access
            </h2>
            <p className="text-sm text-muted-foreground">
              Configure call visibility for{' '}
              <span className="font-medium text-foreground">{userName}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground transition hover:text-foreground"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {/* Admin badge notice */}
        {userRole === 'admin' && (
          <div className="border-b border-border bg-muted/50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>
                Admins have access to <strong>all agents</strong> by default.
              </span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading agents...
            </div>
          ) : accessError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Failed to load agent access. Please try again.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Own agent indicator */}
              {accessData?.ownAgent && (
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm font-medium">Own Agent</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {accessData.ownAgent.name}
                    </span>
                    {accessData.ownAgent.extension && (
                      <span className="ml-1 text-xs">
                        (ext: {accessData.ownAgent.extension})
                      </span>
                    )}
                    <span className="ml-2 text-xs text-muted-foreground">
                      — Always has access
                    </span>
                  </p>
                </div>
              )}

              {/* Search and bulk actions */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search agents..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={userRole === 'admin'}
                >
                  All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDeselectAll}
                  disabled={userRole === 'admin'}
                >
                  None
                </Button>
              </div>

              {/* Agent list */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {selectedAgentIds.size} of {allAgents.length - (ownAgentId ? 1 : 0)} agents selected
                </p>
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border">
                  {filteredAgents.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No agents match your search.
                    </div>
                  ) : (
                    filteredAgents.map((agent) => {
                      const isOwnAgent = agent.id === ownAgentId
                      const isChecked = isOwnAgent || selectedAgentIds.has(agent.id)
                      const isDisabled = userRole === 'admin' || isOwnAgent

                      return (
                        <label
                          key={agent.id}
                          className={`flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors ${
                            isDisabled
                              ? 'cursor-not-allowed opacity-60'
                              : 'hover:bg-muted/50'
                          }`}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => handleToggleAgent(agent.id)}
                            disabled={isDisabled}
                          />
                          <span className="flex-1 text-sm">{agent.name}</span>
                          {isOwnAgent && (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            >
                              Own
                            </Badge>
                          )}
                        </label>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border p-4">
          <p className="text-xs text-muted-foreground">
            {hasChanges ? 'Unsaved changes' : 'No changes'}
          </p>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saveMutation.isPending || !hasChanges || userRole === 'admin'}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AgentAccessModal

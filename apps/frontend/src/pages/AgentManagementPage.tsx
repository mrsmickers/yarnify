import { useState, FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { axiosInstance, handleApiError } from '@/api/axios-instance'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { RefreshCw, Users, Phone } from 'lucide-react'

type Agent = {
  id: string
  name: string
  email: string | null
  extension: string | null
  entraUserId: string | null
  entraUser?: {
    id: string
    email: string
    displayName: string | null
    contextBox: string | null
  } | null
  createdAt: string
  updatedAt: string
  _count?: {
    calls: number
  }
}

type EntraUser = {
  id: string
  email: string
  displayName: string | null
  role: string
  enabled: boolean
}

type UpdateAgentPayload = {
  name?: string
  email?: string | null
  extension?: string | null
  entraUserId?: string | null
}

export default function AgentManagementPage() {
  const queryClient = useQueryClient()
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  // Fetch agents
  const { data: agentsData, isLoading } = useQuery<{
    agents: Agent[]
    total: number
  }>({
    queryKey: ['admin', 'agents'],
    queryFn: async () => {
      return await axiosInstance({
        url: '/api/v1/admin/agents',
        method: 'GET',
      })
    },
  })

  // Fetch users for linking
  const { data: usersData } = useQuery<EntraUser[]>({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      return await axiosInstance({
        url: '/api/v1/admin/users',
        method: 'GET',
      })
    },
  })

  // Update agent mutation
  const updateAgentMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string
      payload: UpdateAgentPayload
    }) => {
      return await axiosInstance({
        url: `/api/v1/admin/agents/${id}`,
        method: 'PATCH',
        data: payload,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] })
      setIsEditDialogOpen(false)
      setEditingAgent(null)
    },
  })

  // Sync agents mutation
  const syncAgentsMutation = useMutation({
    mutationFn: async () => {
      return await axiosInstance({
        url: '/api/v1/admin/agents/sync',
        method: 'GET',
      })
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] })
      toast.success(
        `Sync complete: ${data.created} created, ${data.updated} updated`
      )
      setIsSyncing(false)
    },
    onError: (error) => {
      toast.error(handleApiError(error))
      setIsSyncing(false)
    },
  })

  // Link calls to agents mutation
  const linkCallsMutation = useMutation({
    mutationFn: async () => {
      return await axiosInstance({
        url: '/api/v1/admin/agents/link-calls',
        method: 'GET',
      })
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] })
      toast.success(
        `Linked ${data.linked} calls to agents (${data.skipped} skipped, ${data.errors} errors)`
      )
    },
    onError: (error) => {
      toast.error(handleApiError(error))
    },
  })

  const handleSync = () => {
    setIsSyncing(true)
    syncAgentsMutation.mutate()
  }

  const handleLinkCalls = () => {
    toast.promise(linkCallsMutation.mutateAsync(), {
      loading: 'Linking calls to agents...',
      success: (data) =>
        `Linked ${data.linked} calls successfully`,
      error: (err) => handleApiError(err),
    })
  }

  const handleEditAgent = (agent: Agent) => {
    setEditingAgent(agent)
    setIsEditDialogOpen(true)
  }

  const handleUpdateAgent = (input: UpdateAgentPayload, agentId: string) => {
    const payload: UpdateAgentPayload = {}

    if (input.name !== undefined) payload.name = input.name.trim()
    if (input.email !== undefined) payload.email = input.email?.trim() || null
    if (input.extension !== undefined)
      payload.extension = input.extension?.trim() || null
    if (input.entraUserId !== undefined) payload.entraUserId = input.entraUserId

    const mutationPromise = updateAgentMutation.mutateAsync({
      id: agentId,
      payload,
    })

    toast.promise(mutationPromise, {
      loading: 'Updating agent...',
      success: () => `Agent updated successfully`,
      error: (mutationError) => handleApiError(mutationError),
    })

    return mutationPromise
  }

  const agents = agentsData?.agents || []
  const users = usersData || []
  const availableUsers = users.filter(
    (user) =>
      !agents.some(
        (agent) =>
          agent.entraUserId === user.id &&
          agent.id !== editingAgent?.id
      )
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent Management"
        description="Manage call agents and link them to login accounts"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agents.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Linked to Users
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {agents.filter((a) => a.entraUserId).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Extensions</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {agents.filter((a) => a.extension).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Agents</CardTitle>
              <CardDescription>
                Manage agents and link them to login accounts
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSync}
                disabled={isSyncing || syncAgentsMutation.isPending}
                size="sm"
                variant="default"
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`}
                />
                Sync from VoIP
              </Button>
              <Button
                onClick={handleLinkCalls}
                disabled={linkCallsMutation.isPending}
                size="sm"
                variant="outline"
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${linkCallsMutation.isPending ? 'animate-spin' : ''}`}
                />
                Link Calls
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No agents found. Click "Sync from VoIP" to import agents from your
              phone system.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Extension</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Linked User</TableHead>
                  <TableHead>Calls</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">{agent.name}</TableCell>
                    <TableCell>
                      {agent.extension ? (
                        <Badge variant="outline">{agent.extension}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {agent.email || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {agent.entraUser ? (
                        <div className="text-sm">
                          <div className="font-medium">
                            {agent.entraUser.displayName ||
                              agent.entraUser.email}
                          </div>
                          <div className="text-muted-foreground">
                            {agent.entraUser.email}
                          </div>
                          {agent.entraUser.contextBox && (
                            <div
                              className="mt-1 text-xs text-muted-foreground italic line-clamp-2"
                              title={agent.entraUser.contextBox}
                            >
                              {agent.entraUser.contextBox}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Not linked</span>
                      )}
                    </TableCell>
                    <TableCell>{agent._count?.calls || 0}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditAgent(agent)}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Agent Dialog */}
      {editingAgent && (
        <EditAgentDialog
          agent={editingAgent}
          availableUsers={availableUsers}
          open={isEditDialogOpen}
          onClose={() => {
            setIsEditDialogOpen(false)
            setEditingAgent(null)
          }}
          onSubmit={(payload) => handleUpdateAgent(payload, editingAgent.id)}
        />
      )}
    </div>
  )
}

type EditAgentDialogProps = {
  agent: Agent
  availableUsers: EntraUser[]
  open: boolean
  onClose: () => void
  onSubmit: (payload: UpdateAgentPayload) => Promise<any>
}

function EditAgentDialog({
  agent,
  availableUsers,
  open,
  onClose,
  onSubmit,
}: EditAgentDialogProps) {
  const [formState, setFormState] = useState({
    name: agent.name,
    extension: agent.extension || '',
    entraUserId: agent.entraUserId || '__none__',
  })
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = formState.name.trim()

    if (!trimmedName) {
      setLocalError('Name is required')
      return
    }

    setLocalError(null)

    try {
      await onSubmit({
        name: trimmedName,
        extension: formState.extension || null,
        entraUserId: formState.entraUserId === '__none__' ? null : (formState.entraUserId || null),
      })
      onClose()
    } catch (error) {
      setLocalError(handleApiError(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Agent</DialogTitle>
          <DialogDescription>
            Update agent information and link to a login account
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {localError && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {localError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-name">Name *</Label>
            <Input
              id="edit-name"
              value={formState.name}
              onChange={(e) =>
                setFormState({ ...formState, name: e.target.value })
              }
              placeholder="Agent name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-extension">Extension</Label>
            <Input
              id="edit-extension"
              value={formState.extension}
              onChange={(e) =>
                setFormState({ ...formState, extension: e.target.value })
              }
              placeholder="Extension number"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-entra-user">Link to Login Account</Label>
            <Select
              value={formState.entraUserId}
              onValueChange={(value) =>
                setFormState({ ...formState, entraUserId: value })
              }
            >
              <SelectTrigger id="edit-entra-user">
                <SelectValue placeholder="Select user account..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None (unlink)</SelectItem>
                {agent.entraUser && (
                  <SelectItem value={agent.entraUser.id}>
                    {agent.entraUser.displayName || agent.entraUser.email} (
                    {agent.entraUser.email})
                  </SelectItem>
                )}
                {availableUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.displayName || user.email} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Link this agent to a user login account for access control
            </p>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}


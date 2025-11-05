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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { CheckCircle, Edit, Trash2 } from 'lucide-react'

type LLMConfiguration = {
  id: string
  name: string
  useCase: string
  modelName: string
  provider: string
  isActive: boolean
  settings: Record<string, any>
  createdAt: string
  updatedAt: string
}

const USE_CASES = [
  { value: 'TRANSCRIPTION', label: 'Transcription' },
  { value: 'TRANSCRIPTION_REFINEMENT', label: 'Transcript Refinement' },
  { value: 'CALL_ANALYSIS', label: 'Call Analysis' },
  { value: 'EMBEDDINGS', label: 'Embeddings' },
]

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'azure', label: 'Azure OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
]

export default function LLMManagementPage() {
  const queryClient = useQueryClient()
  const [editingConfig, setEditingConfig] = useState<LLMConfiguration | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // Fetch LLM configs
  const { data: configs = [], isLoading } = useQuery<LLMConfiguration[]>({
    queryKey: ['admin', 'llm-configs'],
    queryFn: async () => {
      return await axiosInstance({
        url: '/api/v1/admin/llm-configs',
        method: 'GET',
      })
    },
  })

  // Group configs by use case
  const configsByUseCase = configs.reduce((acc, config) => {
    if (!acc[config.useCase]) {
      acc[config.useCase] = []
    }
    acc[config.useCase].push(config)
    return acc
  }, {} as Record<string, LLMConfiguration[]>)

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: { id?: string; payload: any }) => {
      if (data.id) {
        return await axiosInstance({
          url: `/api/v1/admin/llm-configs/${data.id}`,
          method: 'PATCH',
          data: data.payload,
        })
      } else {
        return await axiosInstance({
          url: '/api/v1/admin/llm-configs',
          method: 'POST',
          data: data.payload,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'llm-configs'] })
      setIsDialogOpen(false)
      setEditingConfig(null)
      setIsCreating(false)
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await axiosInstance({
        url: `/api/v1/admin/llm-configs/${id}`,
        method: 'DELETE',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'llm-configs'] })
    },
  })

  // Activate mutation
  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      return await axiosInstance({
        url: `/api/v1/admin/llm-configs/${id}/activate`,
        method: 'POST',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'llm-configs'] })
    },
  })

  const handleEdit = (config: LLMConfiguration) => {
    setEditingConfig(config)
    setIsCreating(false)
    setIsDialogOpen(true)
  }

  const handleCreate = () => {
    setEditingConfig(null)
    setIsCreating(true)
    setIsDialogOpen(true)
  }

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      const promise = deleteMutation.mutateAsync(id)
      toast.promise(promise, {
        loading: 'Deleting LLM config...',
        success: 'LLM config deleted successfully',
        error: (err) => handleApiError(err),
      })
    }
  }

  const handleActivate = (id: string, name: string) => {
    const promise = activateMutation.mutateAsync(id)
    toast.promise(promise, {
      loading: 'Activating LLM config...',
      success: `"${name}" is now active`,
      error: (err) => handleApiError(err),
    })
  }

  const renderUseCaseSection = (useCase: string, configs: LLMConfiguration[]) => {
    const useCaseLabel =
      USE_CASES.find((uc) => uc.value === useCase)?.label || useCase
    const activeConfig = configs.find((c) => c.isActive)

    return (
      <Card key={useCase} className="border border-border/80">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{useCaseLabel}</CardTitle>
              <CardDescription>
                {activeConfig
                  ? `Active: ${activeConfig.name} (${activeConfig.modelName})`
                  : 'No active configuration'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {configs.map((config) => (
              <div
                key={config.id}
                className={`rounded-lg border p-4 ${
                  config.isActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{config.name}</h4>
                      <Badge variant="outline">{config.modelName}</Badge>
                      <Badge variant="secondary">{config.provider}</Badge>
                      {config.isActive && (
                        <Badge className="bg-green-500">Active</Badge>
                      )}
                    </div>
                    <div className="mt-2 space-y-1">
                      {config.settings?.temperature !== undefined && (
                        <p className="text-sm text-muted-foreground">
                          Temperature: {config.settings.temperature}
                        </p>
                      )}
                      {config.settings?.max_tokens && (
                        <p className="text-sm text-muted-foreground">
                          Max Tokens: {config.settings.max_tokens}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {!config.isActive && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleActivate(config.id, config.name)}
                        disabled={activateMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Activate
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(config)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(config.id, config.name)}
                      disabled={config.isActive || deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="LLM Management"
        description="Manage LLM configurations for different use cases"
        actions={
          <Button onClick={handleCreate}>
            Add LLM Configuration
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading LLM configurations...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {USE_CASES.map((uc) =>
            configsByUseCase[uc.value]
              ? renderUseCaseSection(uc.value, configsByUseCase[uc.value])
              : null
          )}
        </div>
      )}

      {isDialogOpen && (
        <LLMConfigDialog
          config={editingConfig}
          isCreating={isCreating}
          open={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false)
            setEditingConfig(null)
            setIsCreating(false)
          }}
          onSubmit={(data) => {
            const promise = saveMutation.mutateAsync({
              id: editingConfig?.id,
              payload: data,
            })
            toast.promise(promise, {
              loading: editingConfig ? 'Updating LLM config...' : 'Creating LLM config...',
              success: editingConfig
                ? 'LLM config updated successfully'
                : 'LLM config created successfully',
              error: (err) => handleApiError(err),
            })
            return promise
          }}
        />
      )}
    </div>
  )
}

type LLMConfigDialogProps = {
  config: LLMConfiguration | null
  isCreating: boolean
  open: boolean
  onClose: () => void
  onSubmit: (data: any) => Promise<any>
}

function LLMConfigDialog({
  config,
  isCreating,
  open,
  onClose,
  onSubmit,
}: LLMConfigDialogProps) {
  const [formState, setFormState] = useState({
    name: config?.name || '',
    useCase: config?.useCase || 'CALL_ANALYSIS',
    modelName: config?.modelName || '',
    provider: config?.provider || 'openai',
    temperature: config?.settings?.temperature ?? '',
    max_tokens: config?.settings?.max_tokens ?? '',
    top_p: config?.settings?.top_p ?? '',
    frequency_penalty: config?.settings?.frequency_penalty ?? '',
    presence_penalty: config?.settings?.presence_penalty ?? '',
    response_format: config?.settings?.response_format || 'text',
  })
  const [localError, setLocalError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!formState.name.trim()) {
      setLocalError('Name is required')
      return
    }

    if (!formState.modelName.trim()) {
      setLocalError('Model name is required')
      return
    }

    setLocalError(null)
    setIsSubmitting(true)

    try {
      const settings: any = {}
      if (formState.temperature !== '') settings.temperature = parseFloat(String(formState.temperature))
      if (formState.max_tokens !== '') settings.max_tokens = parseInt(String(formState.max_tokens))
      if (formState.top_p !== '') settings.top_p = parseFloat(String(formState.top_p))
      if (formState.frequency_penalty !== '') settings.frequency_penalty = parseFloat(String(formState.frequency_penalty))
      if (formState.presence_penalty !== '') settings.presence_penalty = parseFloat(String(formState.presence_penalty))
      if (formState.response_format) settings.response_format = formState.response_format

      await onSubmit({
        name: formState.name.trim(),
        useCase: formState.useCase,
        modelName: formState.modelName.trim(),
        provider: formState.provider,
        settings,
      })
      onClose()
    } catch (error) {
      setLocalError(handleApiError(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isCreating ? 'Create LLM Configuration' : 'Edit LLM Configuration'}
          </DialogTitle>
          <DialogDescription>
            {isCreating
              ? 'Create a new LLM configuration'
              : 'Update the LLM configuration'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {localError && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {localError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formState.name}
              onChange={(e) =>
                setFormState({ ...formState, name: e.target.value })
              }
              placeholder="e.g., GPT-4o Production"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="useCase">Use Case *</Label>
              <Select
                value={formState.useCase}
                onValueChange={(value) =>
                  setFormState({ ...formState, useCase: value })
                }
              >
                <SelectTrigger id="useCase">
                  <SelectValue placeholder="Select use case..." />
                </SelectTrigger>
                <SelectContent>
                  {USE_CASES.map((uc) => (
                    <SelectItem key={uc.value} value={uc.value}>
                      {uc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider">Provider *</Label>
              <Select
                value={formState.provider}
                onValueChange={(value) =>
                  setFormState({ ...formState, provider: value })
                }
              >
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Select provider..." />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="modelName">Model Name *</Label>
            <Input
              id="modelName"
              value={formState.modelName}
              onChange={(e) =>
                setFormState({ ...formState, modelName: e.target.value })
              }
              placeholder="e.g., gpt-4o, whisper-1"
              required
            />
          </div>

          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium mb-4">Advanced Settings</h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="temperature">Temperature (0-2)</Label>
                <Input
                  id="temperature"
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={formState.temperature}
                  onChange={(e) =>
                    setFormState({ ...formState, temperature: e.target.value })
                  }
                  placeholder="0.7"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_tokens">Max Tokens</Label>
                <Input
                  id="max_tokens"
                  type="number"
                  min="1"
                  value={formState.max_tokens}
                  onChange={(e) =>
                    setFormState({ ...formState, max_tokens: e.target.value })
                  }
                  placeholder="4096"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="top_p">Top P (0-1)</Label>
                <Input
                  id="top_p"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={formState.top_p}
                  onChange={(e) =>
                    setFormState({ ...formState, top_p: e.target.value })
                  }
                  placeholder="1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="response_format">Response Format</Label>
                <Select
                  value={formState.response_format}
                  onValueChange={(value) =>
                    setFormState({ ...formState, response_format: value })
                  }
                >
                  <SelectTrigger id="response_format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="json_object">JSON Object</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="frequency_penalty">Frequency Penalty (-2 to 2)</Label>
                <Input
                  id="frequency_penalty"
                  type="number"
                  step="0.1"
                  min="-2"
                  max="2"
                  value={formState.frequency_penalty}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      frequency_penalty: e.target.value,
                    })
                  }
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="presence_penalty">Presence Penalty (-2 to 2)</Label>
                <Input
                  id="presence_penalty"
                  type="number"
                  step="0.1"
                  min="-2"
                  max="2"
                  value={formState.presence_penalty}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      presence_penalty: e.target.value,
                    })
                  }
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isCreating ? 'Create' : 'Update'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}


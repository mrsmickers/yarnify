import { useState, useEffect, useRef, FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { axiosInstance, handleApiError } from '@/api/axios-instance'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { CheckCircle, Edit, Trash2, ChevronDown, ChevronUp, Code } from 'lucide-react'

type PromptTemplate = {
  id: string
  name: string
  useCase: string
  content: string
  isActive: boolean
  version: number
  createdAt: string
  updatedAt: string
}

const USE_CASES = [
  { value: 'TRANSCRIPTION_REFINEMENT', label: 'Transcription Refinement' },
  { value: 'CALL_ANALYSIS', label: 'Call Analysis' },
  { value: 'AGENT_IDENTIFICATION', label: 'Agent Identification' },
  { value: 'CUSTOM', label: 'Custom' },
]

type TemplateVariable = {
  name: string
  description: string
}

export default function PromptManagementPage() {
  const queryClient = useQueryClient()
  const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // Fetch prompts
  const { data: prompts = [], isLoading } = useQuery<PromptTemplate[]>({
    queryKey: ['admin', 'prompts'],
    queryFn: async () => {
      return await axiosInstance({
        url: '/api/v1/admin/prompts',
        method: 'GET',
      })
    },
  })

  // Group prompts by use case
  const promptsByUseCase = prompts.reduce((acc, prompt) => {
    if (!acc[prompt.useCase]) {
      acc[prompt.useCase] = []
    }
    acc[prompt.useCase].push(prompt)
    return acc
  }, {} as Record<string, PromptTemplate[]>)

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: { id?: string; payload: any }) => {
      if (data.id) {
        return await axiosInstance({
          url: `/api/v1/admin/prompts/${data.id}`,
          method: 'PATCH',
          data: data.payload,
        })
      } else {
        return await axiosInstance({
          url: '/api/v1/admin/prompts',
          method: 'POST',
          data: data.payload,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'prompts'] })
      setIsDialogOpen(false)
      setEditingPrompt(null)
      setIsCreating(false)
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await axiosInstance({
        url: `/api/v1/admin/prompts/${id}`,
        method: 'DELETE',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'prompts'] })
    },
  })

  // Activate mutation
  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      return await axiosInstance({
        url: `/api/v1/admin/prompts/${id}/activate`,
        method: 'POST',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'prompts'] })
    },
  })

  const handleEdit = (prompt: PromptTemplate) => {
    setEditingPrompt(prompt)
    setIsCreating(false)
    setIsDialogOpen(true)
  }

  const handleCreate = () => {
    setEditingPrompt(null)
    setIsCreating(true)
    setIsDialogOpen(true)
  }

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      const promise = deleteMutation.mutateAsync(id)
      toast.promise(promise, {
        loading: 'Deleting prompt...',
        success: 'Prompt deleted successfully',
        error: (err) => handleApiError(err),
      })
    }
  }

  const handleActivate = (id: string, name: string) => {
    const promise = activateMutation.mutateAsync(id)
    toast.promise(promise, {
      loading: 'Activating prompt...',
      success: `"${name}" is now active`,
      error: (err) => handleApiError(err),
    })
  }

  const renderUseCaseSection = (useCase: string, prompts: PromptTemplate[]) => {
    const useCaseLabel =
      USE_CASES.find((uc) => uc.value === useCase)?.label || useCase
    const activePrompt = prompts.find((p) => p.isActive)

    return (
      <Card key={useCase} className="border border-border/80">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{useCaseLabel}</CardTitle>
              <CardDescription>
                {activePrompt
                  ? `Active: ${activePrompt.name} (v${activePrompt.version})`
                  : 'No active prompt'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {prompts.map((prompt) => (
              <div
                key={prompt.id}
                className={`rounded-lg border p-4 ${
                  prompt.isActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{prompt.name}</h4>
                      <Badge variant="outline">v{prompt.version}</Badge>
                      {prompt.isActive && (
                        <Badge className="bg-green-500">Active</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {prompt.content.substring(0, 200)}...
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {!prompt.isActive && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleActivate(prompt.id, prompt.name)}
                        disabled={activateMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Activate
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(prompt)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(prompt.id, prompt.name)}
                      disabled={prompt.isActive || deleteMutation.isPending}
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
        title="Prompt Management"
        description="Manage AI prompts for different use cases"
        actions={
          <Button onClick={handleCreate}>
            Add Prompt
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading prompts...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {USE_CASES.map((uc) =>
            promptsByUseCase[uc.value]
              ? renderUseCaseSection(uc.value, promptsByUseCase[uc.value])
              : null
          )}
        </div>
      )}

      {isDialogOpen && (
        <PromptDialog
          prompt={editingPrompt}
          isCreating={isCreating}
          open={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false)
            setEditingPrompt(null)
            setIsCreating(false)
          }}
          onSubmit={(data) => {
            const promise = saveMutation.mutateAsync({
              id: editingPrompt?.id,
              payload: data,
            })
            toast.promise(promise, {
              loading: editingPrompt ? 'Updating prompt...' : 'Creating prompt...',
              success: editingPrompt
                ? 'Prompt updated successfully'
                : 'Prompt created successfully',
              error: (err) => handleApiError(err),
            })
            return promise
          }}
        />
      )}
    </div>
  )
}

type PromptDialogProps = {
  prompt: PromptTemplate | null
  isCreating: boolean
  open: boolean
  onClose: () => void
  onSubmit: (data: any) => Promise<any>
}

function PromptDialog({
  prompt,
  isCreating,
  open,
  onClose,
  onSubmit,
}: PromptDialogProps) {
  const [formState, setFormState] = useState({
    name: prompt?.name || '',
    useCase: prompt?.useCase || 'CUSTOM',
    content: prompt?.content || '',
    version: prompt?.version || 1,
  })
  const [localError, setLocalError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [variablesExpanded, setVariablesExpanded] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Fetch available variables for the selected use case
  const { data: availableVariables = [] } = useQuery<TemplateVariable[]>({
    queryKey: ['admin', 'prompts', 'variables', formState.useCase],
    queryFn: async () => {
      if (formState.useCase === 'CUSTOM') return []
      return await axiosInstance({
        url: `/api/v1/admin/prompts/variables/${formState.useCase}`,
        method: 'GET',
      })
    },
    enabled: formState.useCase !== 'CUSTOM',
  })

  // Auto-expand variables panel when variables are available
  useEffect(() => {
    if (availableVariables.length > 0) {
      setVariablesExpanded(true)
    } else {
      setVariablesExpanded(false)
    }
  }, [availableVariables])

  const insertVariable = (variableName: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = formState.content
    const insertion = `{{${variableName}}}`
    const newContent = text.substring(0, start) + insertion + text.substring(end)

    setFormState({ ...formState, content: newContent })

    // Restore cursor position after the inserted variable
    requestAnimationFrame(() => {
      textarea.focus()
      const newPos = start + insertion.length
      textarea.setSelectionRange(newPos, newPos)
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!formState.name.trim()) {
      setLocalError('Name is required')
      return
    }

    if (!formState.content.trim()) {
      setLocalError('Content is required')
      return
    }

    setLocalError(null)
    setIsSubmitting(true)

    try {
      await onSubmit({
        name: formState.name.trim(),
        useCase: formState.useCase,
        content: formState.content.trim(),
        version: formState.version,
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isCreating ? 'Create Prompt' : 'Edit Prompt'}
          </DialogTitle>
          <DialogDescription>
            {isCreating
              ? 'Create a new AI prompt template'
              : 'Update the AI prompt template'}
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
              placeholder="e.g., Enhanced Call Analysis v2"
              required
            />
          </div>

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
            <Label htmlFor="version">Version</Label>
            <Input
              id="version"
              type="number"
              min="1"
              value={formState.version}
              onChange={(e) =>
                setFormState({ ...formState, version: parseInt(e.target.value) })
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Prompt Content *</Label>
            <Textarea
              id="content"
              ref={textareaRef}
              value={formState.content}
              onChange={(e) =>
                setFormState({ ...formState, content: e.target.value })
              }
              placeholder="Enter the prompt content..."
              rows={15}
              required
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Code className="h-3 w-3" />
              Use <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs">{'{{variable_name}}'}</code> syntax for dynamic values.
              {availableVariables.length > 0 && ' Available variables are shown below.'}
            </p>
          </div>

          {/* Variable reference panel */}
          {availableVariables.length > 0 && (
            <div className="rounded-lg border border-border/80 bg-muted/30">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
                onClick={() => setVariablesExpanded(!variablesExpanded)}
              >
                <span className="flex items-center gap-2">
                  <Code className="h-4 w-4 text-muted-foreground" />
                  Available Variables ({availableVariables.length})
                </span>
                {variablesExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              {variablesExpanded && (
                <div className="border-t border-border/60 px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {availableVariables.map((v) => (
                      <button
                        key={v.name}
                        type="button"
                        onClick={() => insertVariable(v.name)}
                        className="group inline-flex flex-col items-start rounded-md border border-border/80 bg-background px-3 py-2 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
                        title={`Click to insert {{${v.name}}}`}
                      >
                        <code className="text-xs font-mono font-semibold text-primary group-hover:text-primary/80">
                          {`{{${v.name}}}`}
                        </code>
                        <span className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                          {v.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

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


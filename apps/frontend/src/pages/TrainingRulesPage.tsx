import { useState, FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { axiosInstance, handleApiError } from '@/api/axios-instance'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { toast } from 'sonner'
import {
  GraduationCap,
  Plus,
  Edit,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react'

type TrainingRule = {
  id: string
  title: string
  description: string
  category: string
  department: string | null
  isActive: boolean
  isCritical: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
  createdBy: string | null
}

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'customer_service', label: 'Customer Service' },
  { value: 'sales', label: 'Sales' },
  { value: 'technical', label: 'Technical' },
]

const CATEGORY_COLORS: Record<string, string> = {
  general: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  compliance: 'bg-red-500/10 text-red-400 border-red-500/20',
  customer_service: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  sales: 'bg-green-500/10 text-green-400 border-green-500/20',
  technical: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
}

function getCategoryLabel(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value
}

export default function TrainingRulesPage() {
  const queryClient = useQueryClient()
  const [editingRule, setEditingRule] = useState<TrainingRule | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // Fetch training rules
  const { data: rules = [], isLoading } = useQuery<TrainingRule[]>({
    queryKey: ['admin', 'training-rules'],
    queryFn: async () => {
      return await axiosInstance({
        url: '/api/v1/admin/training-rules',
        method: 'GET',
      })
    },
  })

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: { id?: string; payload: Record<string, unknown> }) => {
      if (data.id) {
        return await axiosInstance({
          url: `/api/v1/admin/training-rules/${data.id}`,
          method: 'PATCH',
          data: data.payload,
        })
      } else {
        return await axiosInstance({
          url: '/api/v1/admin/training-rules',
          method: 'POST',
          data: data.payload,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'training-rules'] })
      setIsDialogOpen(false)
      setEditingRule(null)
      setIsCreating(false)
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await axiosInstance({
        url: `/api/v1/admin/training-rules/${id}`,
        method: 'DELETE',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'training-rules'] })
    },
  })

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await axiosInstance({
        url: `/api/v1/admin/training-rules/${id}`,
        method: 'PATCH',
        data: { isActive },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'training-rules'] })
    },
  })

  const handleCreate = () => {
    setEditingRule(null)
    setIsCreating(true)
    setIsDialogOpen(true)
  }

  const handleEdit = (rule: TrainingRule) => {
    setEditingRule(rule)
    setIsCreating(false)
    setIsDialogOpen(true)
  }

  const handleDelete = (id: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete "${title}"?`)) {
      const promise = deleteMutation.mutateAsync(id)
      toast.promise(promise, {
        loading: 'Deleting rule...',
        success: 'Training rule deleted successfully',
        error: (err) => handleApiError(err),
      })
    }
  }

  const handleToggleActive = (rule: TrainingRule) => {
    const promise = toggleActiveMutation.mutateAsync({
      id: rule.id,
      isActive: !rule.isActive,
    })
    toast.promise(promise, {
      loading: rule.isActive ? 'Deactivating rule...' : 'Activating rule...',
      success: rule.isActive
        ? `"${rule.title}" deactivated`
        : `"${rule.title}" activated`,
      error: (err) => handleApiError(err),
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-10">
        <PageHeader
          title="Training Rules"
          description="Manage training guidelines that the AI evaluates against every call."
        />
        <div className="flex h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  const activeCount = rules.filter((r) => r.isActive).length
  const criticalCount = rules.filter((r) => r.isCritical).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Training Rules"
        description="Manage training guidelines that the AI evaluates against every call."
        actions={
          <Button
            onClick={handleCreate}
            className="bg-[#DEDC00] text-[#1C2533] hover:bg-[#F8AB08]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Rule
          </Button>
        }
      />

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
          <CardContent className="flex items-center gap-4 pt-6">
            <GraduationCap className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{rules.length}</p>
              <p className="text-sm text-muted-foreground">Total Rules</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
          <CardContent className="flex items-center gap-4 pt-6">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{activeCount}</p>
              <p className="text-sm text-muted-foreground">Active Rules</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
          <CardContent className="flex items-center gap-4 pt-6">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold">{criticalCount}</p>
              <p className="text-sm text-muted-foreground">Critical Rules</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules table */}
      <Card className="border border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Training Rules
          </CardTitle>
          <CardDescription>
            These rules are injected into the AI analysis prompt for every call.
            The AI evaluates whether the agent followed or violated each rule.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <GraduationCap className="h-12 w-12 text-muted-foreground/40" />
              <h3 className="mt-4 text-lg font-semibold">No training rules yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Create your first training rule to start evaluating agent
                performance.
              </p>
              <Button
                onClick={handleCreate}
                className="mt-4 bg-[#DEDC00] text-[#1C2533] hover:bg-[#F8AB08]"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Rule
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Critical</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow
                    key={rule.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleEdit(rule)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{rule.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {rule.description}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          CATEGORY_COLORS[rule.category] || CATEGORY_COLORS.general
                        }
                      >
                        {getCategoryLabel(rule.category)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {rule.department || 'All'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {rule.isCritical && (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      )}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleActive(rule)
                        }}
                        className="flex items-center"
                        disabled={toggleActiveMutation.isPending}
                      >
                        {rule.isActive ? (
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
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEdit(rule)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(rule.id, rule.title)
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {isDialogOpen && (
        <TrainingRuleDialog
          rule={editingRule}
          isCreating={isCreating}
          open={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false)
            setEditingRule(null)
            setIsCreating(false)
          }}
          onSubmit={(data) => {
            const promise = saveMutation.mutateAsync({
              id: editingRule?.id,
              payload: data,
            })
            toast.promise(promise, {
              loading: editingRule ? 'Updating rule...' : 'Creating rule...',
              success: editingRule
                ? 'Training rule updated successfully'
                : 'Training rule created successfully',
              error: (err) => handleApiError(err),
            })
            return promise
          }}
        />
      )}
    </div>
  )
}

type TrainingRuleDialogProps = {
  rule: TrainingRule | null
  isCreating: boolean
  open: boolean
  onClose: () => void
  onSubmit: (data: Record<string, unknown>) => Promise<unknown>
}

function TrainingRuleDialog({
  rule,
  isCreating,
  open,
  onClose,
  onSubmit,
}: TrainingRuleDialogProps) {
  const [formState, setFormState] = useState({
    title: rule?.title || '',
    description: rule?.description || '',
    category: rule?.category || 'general',
    department: rule?.department || '',
    isActive: rule?.isActive ?? true,
    isCritical: rule?.isCritical ?? false,
  })
  const [localError, setLocalError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!formState.title.trim()) {
      setLocalError('Title is required')
      return
    }

    if (!formState.description.trim()) {
      setLocalError('Description is required')
      return
    }

    setLocalError(null)
    setIsSubmitting(true)

    try {
      await onSubmit({
        title: formState.title.trim(),
        description: formState.description.trim(),
        category: formState.category,
        department: formState.department.trim() || null,
        isActive: formState.isActive,
        isCritical: formState.isCritical,
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
            {isCreating ? 'Create Training Rule' : 'Edit Training Rule'}
          </DialogTitle>
          <DialogDescription>
            {isCreating
              ? 'Define a new training guideline for the AI to evaluate.'
              : 'Update this training rule.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {localError && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {localError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formState.title}
              onChange={(e) =>
                setFormState({ ...formState, title: e.target.value })
              }
              placeholder="e.g., No understaffing disclosure"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formState.description}
              onChange={(e) =>
                setFormState({ ...formState, description: e.target.value })
              }
              placeholder="Describe the rule clearly. The AI will use this exact text to evaluate calls."
              rows={4}
              required
            />
            <p className="text-xs text-muted-foreground">
              Describe the rule clearly. The AI will use this exact text to
              evaluate calls.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formState.category}
                onValueChange={(value) =>
                  setFormState({ ...formState, category: value })
                }
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={formState.department}
                onChange={(e) =>
                  setFormState({ ...formState, department: e.target.value })
                }
                placeholder="All Departments"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to apply to all departments.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isCritical"
                checked={formState.isCritical}
                onChange={(e) =>
                  setFormState({ ...formState, isCritical: e.target.checked })
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              <div>
                <Label htmlFor="isCritical" className="cursor-pointer">
                  Critical Rule
                </Label>
                <p className="text-xs text-muted-foreground">
                  Critical rules may auto-fail scores in future versions.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isActive"
                checked={formState.isActive}
                onChange={(e) =>
                  setFormState({ ...formState, isActive: e.target.checked })
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              <div>
                <Label htmlFor="isActive" className="cursor-pointer">
                  Active
                </Label>
                <p className="text-xs text-muted-foreground">
                  Only active rules are included in AI call analysis.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#DEDC00] text-[#1C2533] hover:bg-[#F8AB08]"
            >
              {isSubmitting
                ? 'Saving...'
                : isCreating
                  ? 'Create Rule'
                  : 'Update Rule'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

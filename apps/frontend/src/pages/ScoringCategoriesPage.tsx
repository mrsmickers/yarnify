import { useState, FormEvent } from 'react'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import {
  Target,
  Plus,
  Edit,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react'

type ScoringCategory = {
  id: string
  name: string
  label: string
  weight: number
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export default function ScoringCategoriesPage() {
  const queryClient = useQueryClient()
  const [editingCategory, setEditingCategory] = useState<ScoringCategory | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // Fetch scoring categories
  const { data: categories = [], isLoading } = useQuery<ScoringCategory[]>({
    queryKey: ['admin', 'scoring-categories'],
    queryFn: async () => {
      return await axiosInstance({
        url: '/api/v1/admin/scoring/categories',
        method: 'GET',
      })
    },
  })

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: { id?: string; payload: Record<string, unknown> }) => {
      if (data.id) {
        return await axiosInstance({
          url: `/api/v1/admin/scoring/categories/${data.id}`,
          method: 'PATCH',
          data: data.payload,
        })
      } else {
        return await axiosInstance({
          url: '/api/v1/admin/scoring/categories',
          method: 'POST',
          data: data.payload,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'scoring-categories'] })
      setIsDialogOpen(false)
      setEditingCategory(null)
      setIsCreating(false)
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await axiosInstance({
        url: `/api/v1/admin/scoring/categories/${id}`,
        method: 'DELETE',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'scoring-categories'] })
    },
  })

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await axiosInstance({
        url: `/api/v1/admin/scoring/categories/${id}`,
        method: 'PATCH',
        data: { isActive },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'scoring-categories'] })
    },
  })

  const handleCreate = () => {
    setEditingCategory(null)
    setIsCreating(true)
    setIsDialogOpen(true)
  }

  const handleEdit = (category: ScoringCategory) => {
    setEditingCategory(category)
    setIsCreating(false)
    setIsDialogOpen(true)
  }

  const handleDelete = (id: string, label: string) => {
    if (window.confirm(`Are you sure you want to delete "${label}"?`)) {
      const promise = deleteMutation.mutateAsync(id)
      toast.promise(promise, {
        loading: 'Deleting category...',
        success: 'Scoring category deleted successfully',
        error: (err) => handleApiError(err),
      })
    }
  }

  const handleToggleActive = (category: ScoringCategory) => {
    const promise = toggleActiveMutation.mutateAsync({
      id: category.id,
      isActive: !category.isActive,
    })
    toast.promise(promise, {
      loading: category.isActive ? 'Deactivating...' : 'Activating...',
      success: category.isActive
        ? `"${category.label}" deactivated`
        : `"${category.label}" activated`,
      error: (err) => handleApiError(err),
    })
  }

  // Calculate total weight to show warning
  const totalWeight = categories
    .filter((c) => c.isActive)
    .reduce((sum, c) => sum + c.weight, 0)
  const weightWarning = totalWeight !== 100 && categories.length > 0

  if (isLoading) {
    return (
      <div className="space-y-10">
        <PageHeader
          title="Scoring Categories"
          description="Configure how call quality scores are weighted across categories."
        />
        <div className="flex h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scoring Categories"
        description="Configure how call quality scores are weighted across categories."
        actions={
          <Button
            onClick={handleCreate}
            className="bg-[#DEDC00] text-[#1C2533] hover:bg-[#F8AB08]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        }
      />

      {/* Weight warning */}
      {weightWarning && (
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-500">
                Weights don't sum to 100%
              </p>
              <p className="text-xs text-muted-foreground">
                Active category weights currently sum to{' '}
                <span className="font-bold">{totalWeight}%</span>. For accurate
                scoring, they should total exactly 100%.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
          <CardContent className="flex items-center gap-4 pt-6">
            <Target className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{categories.length}</p>
              <p className="text-sm text-muted-foreground">Total Categories</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
          <CardContent className="flex items-center gap-4 pt-6">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">
                {categories.filter((c) => c.isActive).length}
              </p>
              <p className="text-sm text-muted-foreground">Active Categories</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
          <CardContent className="flex items-center gap-4 pt-6">
            <Target className="h-8 w-8 text-[#DEDC00]" />
            <div>
              <p className="text-2xl font-bold">{totalWeight}%</p>
              <p className="text-sm text-muted-foreground">
                Total Weight{' '}
                {totalWeight === 100 ? (
                  <CheckCircle className="inline h-3 w-3 text-green-500" />
                ) : (
                  <AlertTriangle className="inline h-3 w-3 text-amber-500" />
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Categories table */}
      <Card className="border border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Scoring Categories
          </CardTitle>
          <CardDescription>
            Categories group training rules and assign weight to each area of
            evaluation. Active category weights should sum to 100%.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Target className="h-12 w-12 text-muted-foreground/40" />
              <h3 className="mt-4 text-lg font-semibold">
                No scoring categories yet
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Create scoring categories to weight different aspects of call
                quality evaluation.
              </p>
              <Button
                onClick={handleCreate}
                className="mt-4 bg-[#DEDC00] text-[#1C2533] hover:bg-[#F8AB08]"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Category
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Name (key)</TableHead>
                  <TableHead>Weight (%)</TableHead>
                  <TableHead>Sort Order</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow
                    key={category.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleEdit(category)}
                  >
                    <TableCell>
                      <p className="font-medium">{category.label}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {category.name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">{category.weight}%</span>
                    </TableCell>
                    <TableCell>{category.sortOrder}</TableCell>
                    <TableCell>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleActive(category)
                        }}
                        className="flex items-center"
                        disabled={toggleActiveMutation.isPending}
                      >
                        {category.isActive ? (
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
                            handleEdit(category)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(category.id, category.label)
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
        <ScoringCategoryDialog
          category={editingCategory}
          isCreating={isCreating}
          open={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false)
            setEditingCategory(null)
            setIsCreating(false)
          }}
          onSubmit={(data) => {
            const promise = saveMutation.mutateAsync({
              id: editingCategory?.id,
              payload: data,
            })
            toast.promise(promise, {
              loading: editingCategory
                ? 'Updating category...'
                : 'Creating category...',
              success: editingCategory
                ? 'Scoring category updated successfully'
                : 'Scoring category created successfully',
              error: (err) => handleApiError(err),
            })
            return promise
          }}
        />
      )}
    </div>
  )
}

type ScoringCategoryDialogProps = {
  category: ScoringCategory | null
  isCreating: boolean
  open: boolean
  onClose: () => void
  onSubmit: (data: Record<string, unknown>) => Promise<unknown>
}

function ScoringCategoryDialog({
  category,
  isCreating,
  open,
  onClose,
  onSubmit,
}: ScoringCategoryDialogProps) {
  const [formState, setFormState] = useState({
    name: category?.name || '',
    label: category?.label || '',
    weight: category?.weight ?? 100,
    isActive: category?.isActive ?? true,
    sortOrder: category?.sortOrder ?? 0,
  })
  const [localError, setLocalError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!formState.name.trim()) {
      setLocalError('Name is required')
      return
    }

    if (!/^[a-z_]+$/.test(formState.name.trim())) {
      setLocalError('Name must be lowercase letters and underscores only')
      return
    }

    if (!formState.label.trim()) {
      setLocalError('Label is required')
      return
    }

    if (formState.weight < 0 || formState.weight > 100) {
      setLocalError('Weight must be between 0 and 100')
      return
    }

    setLocalError(null)
    setIsSubmitting(true)

    try {
      await onSubmit({
        name: formState.name.trim(),
        label: formState.label.trim(),
        weight: formState.weight,
        isActive: formState.isActive,
        sortOrder: formState.sortOrder,
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isCreating ? 'Create Scoring Category' : 'Edit Scoring Category'}
          </DialogTitle>
          <DialogDescription>
            {isCreating
              ? 'Define a new scoring category for call quality evaluation.'
              : 'Update this scoring category.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {localError && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {localError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="label">Display Label *</Label>
            <Input
              id="label"
              value={formState.label}
              onChange={(e) =>
                setFormState({ ...formState, label: e.target.value })
              }
              placeholder="e.g., Customer Service"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name (key) *</Label>
            <Input
              id="name"
              value={formState.name}
              onChange={(e) =>
                setFormState({
                  ...formState,
                  name: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                })
              }
              placeholder="e.g., customer_service"
              required
            />
            <p className="text-xs text-muted-foreground">
              Lowercase with underscores. Used to match training rule categories.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (%)</Label>
              <Input
                id="weight"
                type="number"
                min={0}
                max={100}
                value={formState.weight}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    weight: parseInt(e.target.value) || 0,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Percentage weight (0-100). All active weights should sum to 100%.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sortOrder">Sort Order</Label>
              <Input
                id="sortOrder"
                type="number"
                min={0}
                value={formState.sortOrder}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    sortOrder: parseInt(e.target.value) || 0,
                  })
                }
              />
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
                Only active categories contribute to the overall score.
              </p>
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
                  ? 'Create Category'
                  : 'Update Category'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

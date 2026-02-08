import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { toast } from 'sonner'
import { Loader2, X } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { axiosInstance, handleApiError } from '@/api/axios-instance'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

dayjs.extend(relativeTime)

const DEPARTMENT_OPTIONS = [
  { value: 'sales', label: 'Sales' },
  { value: 'service', label: 'Service' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'finance', label: 'Finance' },
  { value: 'projects', label: 'Projects' },
] as const

type UserRole = 'admin' | 'manager' | 'team_lead' | 'user'

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'team_lead', label: 'Team Lead' },
  { value: 'user', label: 'User' },
] as const
type Department = 'sales' | 'service' | 'marketing' | 'finance' | 'projects'

// Helper to normalize department value from database to enum
const normalizeDepartment = (dept: string | null | undefined): Department => {
  if (!dept) return 'sales'
  const normalized = dept.toLowerCase().trim()
  // Check if it's a valid department value
  const validDepartments: Department[] = ['sales', 'service', 'marketing', 'finance', 'projects']
  if (validDepartments.includes(normalized as Department)) {
    return normalized as Department
  }
  // Default to sales if invalid
  return 'sales'
}

type AdminUser = {
  id: string
  oid: string | null
  email: string
  displayName: string | null
  department: string | null
  contextBox: string | null
  role: UserRole
  enabled: boolean
  lastLoginAt: string | null
  lastSyncedAt: string | null
  createdAt: string
  updatedAt: string
}

type AdminStats = {
  users: {
    total: number
    active: number
    disabled: number
    admins: number
  }
  activity: {
    loginsLast7Days: number
  }
}

type UpdateRoleResponse = {
  success: boolean
  user: {
    id: string
    email: string
    role: UserRole
    department: string | null
  }
}

type UpdateStatusResponse = {
  success: boolean
  user: {
    id: string
    email: string
    enabled: boolean
  }
}

type CreateUserPayload = {
  email: string
  displayName: string
  department: Department
  role: UserRole
  enabled: boolean
}

type CreateUserResponse = {
  success: boolean
  user: AdminUser
}

type UpdateUserPayload = {
  displayName: string
  department: Department
  role?: UserRole
  enabled?: boolean
  contextBox?: string | null
}

type UpdateUserResponse = {
  success: boolean
  user: AdminUser
}

const usersQueryKey = ['admin-users'] as const
const statsQueryKey = ['admin-stats'] as const

const fetchAdminUsers = async (): Promise<AdminUser[]> => {
  try {
    return await axiosInstance<AdminUser[]>({
      url: '/api/v1/admin/users',
      method: 'GET',
    })
  } catch (error) {
    throw new Error(handleApiError(error))
  }
}

const fetchAdminStats = async (): Promise<AdminStats> => {
  try {
    return await axiosInstance<AdminStats>({
      url: '/api/v1/admin/stats',
      method: 'GET',
    })
  } catch (error) {
    throw new Error(handleApiError(error))
  }
}

const UserManagementPage = () => {
  const queryClient = useQueryClient()
  const [roleUpdatingId, setRoleUpdatingId] = useState<string | null>(null)
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)

  const {
    data: users = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<AdminUser[], Error>({
    queryKey: usersQueryKey,
    queryFn: fetchAdminUsers,
    staleTime: 30_000,
  })

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    error: statsErrorObject,
  } = useQuery<AdminStats, Error>({
    queryKey: statsQueryKey,
    queryFn: fetchAdminStats,
    staleTime: 60_000,
  })

  const updateRoleMutation = useMutation<
    UpdateRoleResponse,
    Error,
    { id: string; role: UserRole }
  >({
    mutationFn: ({ id, role }) =>
      axiosInstance<UpdateRoleResponse>({
        url: `/api/v1/admin/users/${id}/role`,
        method: 'PATCH',
        data: { role },
      }),
    onSuccess: (response) => {
      queryClient.setQueryData<AdminUser[]>(usersQueryKey, (previous) =>
        previous
          ? previous.map((user) =>
              user.id === response.user.id
                ? { ...user, role: response.user.role }
                : user
            )
          : previous
      )
      queryClient.invalidateQueries({ queryKey: statsQueryKey })
    },
  })

  const toggleStatusMutation = useMutation<
    UpdateStatusResponse,
    Error,
    { id: string; enabled: boolean }
  >({
    mutationFn: ({ id, enabled }) =>
      axiosInstance<UpdateStatusResponse>({
        url: `/api/v1/admin/users/${id}/${enabled ? 'enable' : 'disable'}`,
        method: 'PATCH',
      }),
    onSuccess: (response) => {
      queryClient.setQueryData<AdminUser[]>(usersQueryKey, (previous) =>
        previous
          ? previous.map((user) =>
              user.id === response.user.id
                ? { ...user, enabled: response.user.enabled }
                : user
            )
          : previous
      )
      queryClient.invalidateQueries({ queryKey: statsQueryKey })
    },
  })

  const updateUserMutation = useMutation<
    UpdateUserResponse,
    Error,
    { id: string; payload: UpdateUserPayload }
  >({
    mutationFn: ({ id, payload }) =>
      axiosInstance<UpdateUserResponse>({
        url: `/api/v1/admin/users/${id}`,
        method: 'PATCH',
        data: payload,
      }),
    onSuccess: (response) => {
      const updatedUser = response.user
      queryClient.setQueryData<AdminUser[]>(usersQueryKey, (previous) =>
        previous
          ? previous.map((user) =>
              user.id === updatedUser.id ? updatedUser : user
            )
          : previous
      )
      queryClient.invalidateQueries({ queryKey: statsQueryKey })
      setEditingUser(null)
    },
  })

  const createUserMutation = useMutation<
    CreateUserResponse,
    Error,
    CreateUserPayload
  >({
    mutationFn: (payload) =>
      axiosInstance<CreateUserResponse>({
        url: '/api/v1/admin/users',
        method: 'POST',
        data: payload,
      }),
    onSuccess: (response) => {
      const createdUser = response.user
      queryClient.setQueryData<AdminUser[]>(usersQueryKey, (previous) =>
        previous ? [createdUser, ...previous] : [createdUser]
      )
      queryClient.invalidateQueries({ queryKey: statsQueryKey })
    },
  })

  const handleRoleChange = async (user: AdminUser, role: UserRole) => {
    if (role === user.role) return
    setRoleUpdatingId(user.id)
    const mutationPromise = updateRoleMutation.mutateAsync({ id: user.id, role })
    toast.promise(mutationPromise, {
      loading: `Updating role for ${user.displayName ?? user.email}...`,
      success: (response) =>
        `${response.user.email} is now ${response.user.role}.`,
      error: (mutationError) => handleApiError(mutationError),
    })

    try {
      await mutationPromise
    } finally {
      setRoleUpdatingId(null)
    }
  }

  const handleToggleStatus = async (user: AdminUser) => {
    const nextEnabled = !user.enabled
    setStatusUpdatingId(user.id)
    const mutationPromise = toggleStatusMutation.mutateAsync({
      id: user.id,
      enabled: nextEnabled,
    })

    toast.promise(mutationPromise, {
      loading: `${nextEnabled ? 'Enabling' : 'Disabling'} ${
        user.displayName ?? user.email
      }...`,
      success: (response) =>
        `${response.user.email} is now ${
          response.user.enabled ? 'enabled' : 'disabled'
        }.`,
      error: (mutationError) => handleApiError(mutationError),
    })

    try {
      await mutationPromise
    } finally {
      setStatusUpdatingId(null)
    }
  }

  const handleUpdateUser = (input: UpdateUserPayload, userId: string) => {
    // Ensure displayName is trimmed and not empty
    const trimmedDisplayName = input.displayName.trim()
    if (!trimmedDisplayName) {
      throw new Error('Display name cannot be empty')
    }

    // Ensure department is a valid enum value (should already be normalized)
    if (!input.department || !['sales', 'service', 'marketing', 'finance', 'projects'].includes(input.department)) {
      throw new Error('Invalid department value')
    }

    // Build payload with required fields
    const payload: any = {
      displayName: trimmedDisplayName,
      department: input.department,
    }
    
    // Only include optional fields if they're explicitly provided
    if (input.role !== undefined && input.role !== null) {
      payload.role = input.role
    }
    if (input.enabled !== undefined && input.enabled !== null) {
      payload.enabled = Boolean(input.enabled)
    }
    if (input.contextBox !== undefined) {
      payload.contextBox = input.contextBox
    }

    console.log('[handleUpdateUser] Sending payload:', JSON.stringify(payload, null, 2))

    const mutationPromise = updateUserMutation.mutateAsync({
      id: userId,
      payload: payload as UpdateUserPayload,
    })

    toast.promise(mutationPromise, {
      loading: 'Updating user...',
      success: (response) =>
        `${response.user.email} updated successfully.`,
      error: (mutationError) => {
        console.error('[handleUpdateUser] Mutation error:', mutationError)
        console.error('[handleUpdateUser] Error response:', (mutationError as any)?.response?.data)
        return handleApiError(mutationError)
      },
    })

    return mutationPromise
  }

  const handleCreateUser = (input: CreateUserPayload) => {
    const payload: CreateUserPayload = {
      email: input.email.trim().toLowerCase(),
      displayName: input.displayName.trim(),
      department: input.department.trim(),
      role: input.role,
      enabled: input.enabled,
    }

    const mutationPromise = createUserMutation.mutateAsync(payload)

    toast.promise(mutationPromise, {
      loading: `Provisioning ${payload.email}...`,
      success: (response) =>
        `${response.user.email} added as ${response.user.role}.`,
      error: (mutationError) => handleApiError(mutationError),
    })

    return mutationPromise
  }

  const columns = useMemo<ColumnDef<AdminUser>[]>(
    () => [
      {
        header: 'User',
        accessorKey: 'displayName',
        cell: ({ row }) => {
          const user = row.original
          return (
            <button
              type="button"
              onClick={() => setEditingUser(user)}
              className="flex flex-col text-left hover:opacity-80 transition-opacity cursor-pointer"
            >
              <span className="font-medium text-foreground">
                {user.displayName || '—'}
              </span>
              <span className="text-muted-foreground text-sm tracking-tight">
                {user.email}
              </span>
            </button>
          )
        },
      },
      {
        header: 'Role',
        accessorKey: 'role',
        cell: ({ row }) => {
          const user = row.original
          const roleConfig: Record<string, { variant: 'default' | 'secondary' | 'outline'; label: string; className?: string }> = {
            admin: { variant: 'default', label: 'Admin' },
            manager: { variant: 'default', label: 'Manager', className: 'bg-purple-500/15 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300 border-0' },
            team_lead: { variant: 'default', label: 'Team Lead', className: 'bg-blue-500/15 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300 border-0' },
            user: { variant: 'secondary', label: 'User' },
          }
          const config = roleConfig[user.role] || roleConfig.user
          return (
            <Badge variant={config.variant} className={config.className}>
              {config.label}
            </Badge>
          )
        },
      },
      {
        header: 'Department',
        accessorKey: 'department',
        cell: ({ row }) => {
          const user = row.original
          return (
            <span className="text-foreground">
              {user.department || '—'}
            </span>
          )
        },
      },
      {
        header: 'Status',
        accessorKey: 'enabled',
        cell: ({ row }) => {
          const user = row.original
          const variant = user.enabled ? 'default' : 'outline'
          return (
            <Badge
              variant={variant}
              className={
                user.enabled
                  ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
                  : 'border-border text-muted-foreground'
              }
            >
              {user.enabled ? 'Active' : 'Disabled'}
            </Badge>
          )
        },
      },
      {
        header: 'Last login',
        accessorKey: 'lastLoginAt',
        cell: ({ row }) => {
          const user = row.original
          if (!user.lastLoginAt) {
            return <span className="text-muted-foreground">Never</span>
          }

          return (
            <span className="text-foreground">
              {dayjs(user.lastLoginAt).fromNow()}
            </span>
          )
        },
      },
      {
        header: 'Actions',
        cell: ({ row }) => {
          const user = row.original
          const isUpdating = statusUpdatingId === user.id
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                variant={user.enabled ? 'outline' : 'default'}
                onClick={() => {
                  void handleToggleStatus(user)
                }}
                disabled={isUpdating || toggleStatusMutation.isPending}
              >
                {isUpdating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {user.enabled ? 'Disable' : 'Enable'}
              </Button>
            </div>
          )
        },
      },
    ],
    [
      handleRoleChange,
      handleToggleStatus,
      roleUpdatingId,
      statusUpdatingId,
      toggleStatusMutation.isPending,
      updateRoleMutation.isPending,
    ]
  )

  const activeCount = users.filter((user) => user.enabled).length
  const adminCount = users.filter((user) => user.role === 'admin').length
  const derivedStats: AdminStats = stats ?? {
    users: {
      total: users.length,
      active: activeCount,
      disabled: users.length - activeCount,
      admins: adminCount,
    },
    activity: {
      loginsLast7Days: 0,
    },
  }

  const renderUsersTable = () => {
    if (isLoading) {
      return (
        <div className="flex h-48 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
          Loading users...
        </div>
      )
    }

    if (isError) {
      return (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <p className="max-w-md text-sm text-destructive">
            {error?.message || 'Failed to load users. Please try again.'}
          </p>
          <Button onClick={() => void refetch()} variant="outline">
            Retry
          </Button>
        </div>
      )
    }

    if (!users.length) {
      return (
        <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
          <p className="text-sm font-medium">
            No users have been provisioned yet.
          </p>
          <p className="text-xs">
            Use “Add user” to register authorised accounts before they sign in
            with Entra.
          </p>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {isFetching ? (
          <div className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Refreshing…
          </div>
        ) : null}
        <DataTable data={users} columns={columns} />
      </div>
    )
  }

  const statsErrorMessage =
    statsError && statsErrorObject
      ? statsErrorObject.message
      : undefined

const statsCards = [
  {
    label: 'Total users',
    value: derivedStats.users.total,
    hint: `${derivedStats.users.active} active`,
    },
    {
      label: 'Admins',
      value: derivedStats.users.admins,
      hint: `${derivedStats.users.total - derivedStats.users.admins} standard`,
    },
    {
      label: 'Disabled',
      value: derivedStats.users.disabled,
      hint: 'Access revoked',
    },
    {
      label: 'Logins (7 days)',
      value: derivedStats.activity.loginsLast7Days,
      hint: 'Recent sign-ins',
    },
  ]

  return (
    <>
      <div className="space-y-10">
        <PageHeader
          title="User Management"
          description="Invite, promote, or suspend users to keep The Oracle secure."
          actions={
            <Button
              type="button"
              onClick={() => setIsAddDialogOpen(true)}
              className="min-w-[140px]"
            >
              Add user
            </Button>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statsCards.map((card) => (
            <Card
              key={card.label}
              className="border border-border/80 bg-card/70 backdrop-blur-sm dark:border-border/40"
            >
              <CardHeader className="space-y-1 pb-2">
                <CardDescription>{card.label}</CardDescription>
                <CardTitle className="text-3xl font-semibold">
                  {statsLoading ? (
                    <Skeleton className="h-8 w-20 rounded-md" />
                  ) : (
                    card.value
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {statsLoading ? (
                  <Skeleton className="h-4 w-32 rounded-md" />
                ) : (
                  card.hint
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {statsErrorMessage ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Failed to load system statistics: {statsErrorMessage}
          </div>
        ) : null}

        <Card className="border border-border/80 bg-card/70 backdrop-blur-sm dark:border-border/40">
          <CardHeader className="space-y-2">
            <CardTitle>User directory</CardTitle>
            <CardDescription>
              Assign roles and control access for The Oracle administrators and
              operators.
            </CardDescription>
          </CardHeader>
          <CardContent>{renderUsersTable()}</CardContent>
        </Card>
      </div>

      <AddUserDialog
        open={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onSubmit={handleCreateUser}
        isSubmitting={createUserMutation.isPending}
      />

      {editingUser && (
        <EditUserDialog
          open={!!editingUser}
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSubmit={(payload) => handleUpdateUser(payload, editingUser.id)}
          isSubmitting={updateUserMutation.isPending}
        />
      )}
    </>
  )
}

type AddUserDialogProps = {
  open: boolean
  onClose: () => void
  onSubmit: (payload: CreateUserPayload) => Promise<unknown>
  isSubmitting: boolean
}

type AddUserFormState = {
  email: string
  displayName: string
  department: Department
  role: UserRole
  status: 'enabled' | 'disabled'
}

const INITIAL_FORM_STATE: AddUserFormState = {
  email: '',
  displayName: '',
  department: DEPARTMENT_OPTIONS[0]?.value ?? 'sales',
  role: 'user',
  status: 'enabled',
}

const AddUserDialog = ({
  open,
  onClose,
  onSubmit,
  isSubmitting,
}: AddUserDialogProps) => {
  const [formState, setFormState] = useState<AddUserFormState>({
    ...INITIAL_FORM_STATE,
  })
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setFormState({ ...INITIAL_FORM_STATE })
      setLocalError(null)
    }
  }, [open])

  if (!open) {
    return null
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedEmail = formState.email.trim()
    const trimmedDisplayName = formState.displayName.trim()

    if (!trimmedEmail) {
      setLocalError('Email is required')
      return
    }

    if (!trimmedDisplayName) {
      setLocalError('Display name is required')
      return
    }

    if (!formState.department) {
      setLocalError('Department is required')
      return
    }

    setLocalError(null)

    try {
      await onSubmit({
        email: trimmedEmail,
        displayName: trimmedDisplayName,
        department: formState.department,
        role: formState.role,
        enabled: formState.status === 'enabled',
      })
      onClose()
    } catch (error) {
      setLocalError(handleApiError(error))
    }
  }

  const errorMessage = localError

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground transition hover:text-foreground"
          aria-label="Close dialog"
          disabled={isSubmitting}
        >
          <X className="h-5 w-5" aria-hidden />
        </button>

        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">
            Add user
          </h2>
          <p className="text-sm text-muted-foreground">
            Provision a Microsoft Entra account before first login by assigning email,
            department, and access level.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="add-user-email">Email</Label>
            <Input
              id="add-user-email"
              type="email"
              value={formState.email}
              onChange={(event) =>
                setFormState((previous) => ({
                  ...previous,
                  email: event.target.value,
                }))
              }
              placeholder="user@company.com"
              autoComplete="off"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-user-name">Display name</Label>
            <Input
              id="add-user-name"
              value={formState.displayName}
              onChange={(event) =>
                setFormState((previous) => ({
                  ...previous,
                  displayName: event.target.value,
                }))
              }
              placeholder="Jane Doe"
              autoComplete="off"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-user-department">Department</Label>
            <Select
              value={formState.department}
              onValueChange={(value) =>
                setFormState((previous) => ({
                  ...previous,
                  department: value as Department,
                }))
              }
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENT_OPTIONS.map((dept) => (
                  <SelectItem key={dept.value} value={dept.value}>
                    {dept.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={formState.role}
                onValueChange={(value) =>
                  setFormState((previous) => ({
                    ...previous,
                    role: value as UserRole,
                  }))
                }
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Account status</Label>
              <Select
                value={formState.status}
                onValueChange={(value) =>
                  setFormState((previous) => ({
                    ...previous,
                    status: value as 'enabled' | 'disabled',
                  }))
                }
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enabled">Active</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {errorMessage ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Add user'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

type EditUserDialogProps = {
  open: boolean
  user: AdminUser
  onClose: () => void
  onSubmit: (payload: UpdateUserPayload) => Promise<unknown>
  isSubmitting: boolean
}

type EditUserFormState = {
  displayName: string
  department: Department
  role: UserRole
  status: 'enabled' | 'disabled'
  contextBox: string
}

const EditUserDialog = ({
  open,
  user,
  onClose,
  onSubmit,
  isSubmitting,
}: EditUserDialogProps) => {
  const [formState, setFormState] = useState<EditUserFormState>({
    displayName: user.displayName || '',
    department: normalizeDepartment(user.department),
    role: user.role,
    status: user.enabled ? 'enabled' : 'disabled',
    contextBox: user.contextBox || '',
  })
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (open && user) {
      setFormState({
        displayName: user.displayName || '',
        department: normalizeDepartment(user.department),
        role: user.role,
        status: user.enabled ? 'enabled' : 'disabled',
        contextBox: user.contextBox || '',
      })
      setLocalError(null)
    }
  }, [open, user])

  if (!open) {
    return null
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedDisplayName = formState.displayName.trim()

    if (!trimmedDisplayName) {
      setLocalError('Display name is required')
      return
    }

    if (!formState.department) {
      setLocalError('Department is required')
      return
    }

    setLocalError(null)

    try {
      const payload = {
        displayName: trimmedDisplayName,
        department: formState.department,
        role: formState.role,
        enabled: formState.status === 'enabled',
        contextBox: formState.contextBox || null,
      }
      console.log('[EditUserDialog] Submitting payload:', payload)
      await onSubmit(payload)
      onClose()
    } catch (error) {
      console.error('[EditUserDialog] Error submitting form:', error)
      setLocalError(handleApiError(error))
    }
  }

  const errorMessage = localError

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground transition hover:text-foreground"
          aria-label="Close dialog"
          disabled={isSubmitting}
        >
          <X className="h-5 w-5" aria-hidden />
        </button>

        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">
            Edit user
          </h2>
          <p className="text-sm text-muted-foreground">
            Update user information, department, and access level.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="edit-user-email">Email</Label>
            <Input
              id="edit-user-email"
              type="email"
              value={user.email}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-user-name">Display name</Label>
            <Input
              id="edit-user-name"
              value={formState.displayName}
              onChange={(event) =>
                setFormState((previous) => ({
                  ...previous,
                  displayName: event.target.value,
                }))
              }
              placeholder="Jane Doe"
              autoComplete="off"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-user-department">Department</Label>
            <Select
              value={formState.department}
              onValueChange={(value) =>
                setFormState((previous) => ({
                  ...previous,
                  department: value as Department,
                }))
              }
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENT_OPTIONS.map((dept) => (
                  <SelectItem key={dept.value} value={dept.value}>
                    {dept.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-user-context-box">Profile Context</Label>
            <Textarea
              id="edit-user-context-box"
              value={formState.contextBox}
              onChange={(event) =>
                setFormState((previous) => ({
                  ...previous,
                  contextBox: event.target.value,
                }))
              }
              placeholder="Describe role, skills, and context for AI analysis..."
              rows={4}
              className="resize-y"
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              This context is included when the AI analyses the user's calls.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-user-role">Role</Label>
              <Select
                value={formState.role}
                onValueChange={(value) =>
                  setFormState((previous) => ({
                    ...previous,
                    role: value as UserRole,
                  }))
                }
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Account status</Label>
              <Select
                value={formState.status}
                onValueChange={(value) =>
                  setFormState((previous) => ({
                    ...previous,
                    status: value as 'enabled' | 'disabled',
                  }))
                }
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enabled">Active</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {errorMessage ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save changes'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default UserManagementPage

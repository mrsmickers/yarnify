import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Shield, Users, UserCheck } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { axiosInstance, handleApiError } from '@/api/axios-instance'

type Permission = {
  code: string
  name: string
  category: string
  description: string | null
  sortOrder: number
}

type UserOverride = {
  id: string
  userId: string
  permissionCode: string
  granted: boolean
  permission: Permission
}

type User = {
  id: string
  email: string
  displayName: string | null
  role: string
}

const ROLES = ['admin', 'manager', 'team_lead', 'user']

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  team_lead: 'Team Lead',
  user: 'User',
}

const CATEGORY_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  calls: 'Call Management',
  admin: 'Administration',
}

export default function PermissionsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Permissions"
        description="Manage role-based permissions and user-specific overrides"
        icon={<Shield className="h-8 w-8" />}
      />

      <Tabs defaultValue="roles" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="roles" className="gap-2">
            <Users className="h-4 w-4" />
            Role Permissions
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <UserCheck className="h-4 w-4" />
            User Overrides
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roles">
          <RolePermissionsTab />
        </TabsContent>

        <TabsContent value="users">
          <UserOverridesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function RolePermissionsTab() {
  const [selectedRole, setSelectedRole] = useState<string>('admin')
  const [permissions, setPermissions] = useState<Record<string, Permission[]>>({})
  const [rolePermissions, setRolePermissions] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    async function fetchPermissions() {
      try {
        const data = await axiosInstance<Record<string, Permission[]>>({
          url: '/api/v1/permissions/grouped',
          method: 'GET',
        })
        setPermissions(data)
      } catch (error) {
        toast.error('Failed to load permissions: ' + handleApiError(error))
      }
    }
    fetchPermissions()
  }, [])

  useEffect(() => {
    async function fetchRolePermissions() {
      setIsLoading(true)
      try {
        const data = await axiosInstance<string[]>({
          url: `/api/v1/admin/permissions/roles/${selectedRole}`,
          method: 'GET',
        })
        setRolePermissions(data)
      } catch (error) {
        toast.error('Failed to load role permissions: ' + handleApiError(error))
      } finally {
        setIsLoading(false)
      }
    }
    if (selectedRole) {
      fetchRolePermissions()
    }
  }, [selectedRole])

  const handleTogglePermission = (code: string) => {
    setRolePermissions((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await axiosInstance({
        url: `/api/v1/admin/permissions/roles/${selectedRole}`,
        method: 'PUT',
        data: { permissions: rolePermissions },
      })
      toast.success(`Permissions updated for ${ROLE_LABELS[selectedRole]}`)
    } catch (error) {
      toast.error('Failed to save permissions: ' + handleApiError(error))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
      <CardHeader>
        <CardTitle>Role Permissions</CardTitle>
        <CardDescription>
          Configure which permissions are granted to each role by default
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <Label htmlFor="role-select" className="w-24">
            Select Role
          </Label>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger id="role-select" className="w-[200px]">
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading permissions...</div>
        ) : (
          <div className="space-y-6">
            {Object.entries(permissions).map(([category, perms]) => (
              <div key={category} className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {CATEGORY_LABELS[category] || category}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {perms.map((perm) => (
                    <div
                      key={perm.code}
                      className="flex items-start space-x-3 rounded-lg border border-border/60 p-3"
                    >
                      <Checkbox
                        id={`role-${perm.code}`}
                        checked={rolePermissions.includes(perm.code)}
                        onCheckedChange={() => handleTogglePermission(perm.code)}
                        disabled={selectedRole === 'admin'} // Admin always has all permissions
                      />
                      <div className="flex-1 space-y-1">
                        <Label
                          htmlFor={`role-${perm.code}`}
                          className="cursor-pointer font-medium leading-none"
                        >
                          {perm.name}
                        </Label>
                        {perm.description && (
                          <p className="text-xs text-muted-foreground">{perm.description}</p>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {perm.code}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end border-t pt-4">
          <Button
            onClick={handleSave}
            disabled={isSaving || selectedRole === 'admin'}
            className="bg-[#DEDC00] text-[#1C2533] hover:bg-[#F8AB08]"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        {selectedRole === 'admin' && (
          <p className="text-sm text-muted-foreground">
            Note: Administrator role always has all permissions and cannot be modified.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function UserOverridesTab() {
  const [users, setUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [permissions, setPermissions] = useState<Record<string, Permission[]>>({})
  const [userRolePerms, setUserRolePerms] = useState<string[]>([])
  const [overrides, setOverrides] = useState<Map<string, boolean | null>>(new Map())
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Fetch users and permissions on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const [usersData, permsData] = await Promise.all([
          axiosInstance<User[]>({ url: '/api/v1/admin/users', method: 'GET' }),
          axiosInstance<Record<string, Permission[]>>({
            url: '/api/v1/permissions/grouped',
            method: 'GET',
          }),
        ])
        setUsers(usersData)
        setPermissions(permsData)
      } catch (error) {
        toast.error('Failed to load data: ' + handleApiError(error))
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  // Fetch user's role permissions and overrides when user selected
  useEffect(() => {
    if (!selectedUserId) {
      setSelectedUser(null)
      setUserRolePerms([])
      setOverrides(new Map())
      return
    }

    const user = users.find((u) => u.id === selectedUserId)
    setSelectedUser(user || null)

    async function fetchUserData() {
      setIsLoading(true)
      try {
        const [rolePerms, userOverrides] = await Promise.all([
          axiosInstance<string[]>({
            url: `/api/v1/admin/permissions/roles/${user?.role || 'user'}`,
            method: 'GET',
          }),
          axiosInstance<UserOverride[]>({
            url: `/api/v1/admin/permissions/users/${selectedUserId}`,
            method: 'GET',
          }),
        ])
        setUserRolePerms(rolePerms)
        const overrideMap = new Map<string, boolean | null>()
        for (const o of userOverrides) {
          overrideMap.set(o.permissionCode, o.granted)
        }
        setOverrides(overrideMap)
      } catch (error) {
        toast.error('Failed to load user permissions: ' + handleApiError(error))
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserData()
  }, [selectedUserId, users])

  const getEffectiveState = (code: string): 'granted' | 'revoked' | 'default' => {
    const override = overrides.get(code)
    if (override === true) return 'granted'
    if (override === false) return 'revoked'
    return 'default'
  }

  const handleCycleState = (code: string) => {
    const current = getEffectiveState(code)
    const hasRolePerm = userRolePerms.includes(code)
    
    // Cycle: default -> granted -> revoked -> default
    // If role has permission: default(granted) -> revoked -> default
    // If role doesn't have: default(revoked) -> granted -> default
    setOverrides((prev) => {
      const newMap = new Map(prev)
      if (current === 'default') {
        // If role grants it, override to revoke; otherwise override to grant
        newMap.set(code, hasRolePerm ? false : true)
      } else if (current === 'granted') {
        newMap.set(code, false) // revoke
      } else {
        newMap.delete(code) // back to default
      }
      return newMap
    })
  }

  const handleSave = async () => {
    if (!selectedUserId) return
    setIsSaving(true)
    try {
      const overrideArray = Array.from(overrides.entries()).map(([code, granted]) => ({
        code,
        granted,
      }))
      // First clear all overrides, then set new ones
      // Actually we need to handle null for "default" - let's send all permissions with their state
      const allCodes = Object.values(permissions).flat().map((p) => p.code)
      const payload = allCodes.map((code) => ({
        code,
        granted: overrides.has(code) ? overrides.get(code) : null,
      }))

      await axiosInstance({
        url: `/api/v1/admin/permissions/users/${selectedUserId}`,
        method: 'PUT',
        data: { overrides: payload },
      })
      toast.success(`Permission overrides saved for ${selectedUser?.displayName || selectedUser?.email}`)
    } catch (error) {
      toast.error('Failed to save overrides: ' + handleApiError(error))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
      <CardHeader>
        <CardTitle>User Permission Overrides</CardTitle>
        <CardDescription>
          Grant or revoke specific permissions for individual users, overriding their role defaults
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <Label htmlFor="user-select" className="w-24">
            Select User
          </Label>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger id="user-select" className="w-[300px]">
              <SelectValue placeholder="Select a user" />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.displayName || user.email}
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({ROLE_LABELS[user.role] || user.role})
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedUser && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Role:</span>
            <Badge variant="secondary">{ROLE_LABELS[selectedUser.role] || selectedUser.role}</Badge>
            <span className="ml-4">Base permissions from role, click to override</span>
          </div>
        )}

        {!selectedUserId ? (
          <div className="py-8 text-center text-muted-foreground">
            Select a user to manage their permission overrides
          </div>
        ) : isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading permissions...</div>
        ) : (
          <div className="space-y-6">
            {Object.entries(permissions).map(([category, perms]) => (
              <div key={category} className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {CATEGORY_LABELS[category] || category}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {perms.map((perm) => {
                    const state = getEffectiveState(perm.code)
                    const hasRolePerm = userRolePerms.includes(perm.code)
                    const effectivelyGranted =
                      state === 'granted' || (state === 'default' && hasRolePerm)

                    return (
                      <button
                        key={perm.code}
                        type="button"
                        onClick={() => handleCycleState(perm.code)}
                        className={`flex items-start space-x-3 rounded-lg border p-3 text-left transition-colors ${
                          state === 'granted'
                            ? 'border-green-500 bg-green-500/10'
                            : state === 'revoked'
                              ? 'border-red-500 bg-red-500/10'
                              : 'border-border/60'
                        }`}
                      >
                        <div
                          className={`mt-0.5 h-4 w-4 rounded border-2 ${
                            effectivelyGranted
                              ? 'border-green-500 bg-green-500'
                              : 'border-muted-foreground'
                          }`}
                        >
                          {effectivelyGranted && (
                            <svg className="h-full w-full text-white" viewBox="0 0 12 12">
                              <path
                                fill="currentColor"
                                d="M9.765 3.205a.75.75 0 0 1 .03 1.06l-4.25 4.5a.75.75 0 0 1-1.075.015L2.22 6.53a.75.75 0 0 1 1.06-1.06l1.705 1.704 3.72-3.939a.75.75 0 0 1 1.06-.03Z"
                              />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium leading-none">{perm.name}</span>
                            {state !== 'default' && (
                              <Badge
                                variant={state === 'granted' ? 'default' : 'destructive'}
                                className="text-xs"
                              >
                                {state === 'granted' ? 'Granted' : 'Revoked'}
                              </Badge>
                            )}
                            {state === 'default' && hasRolePerm && (
                              <Badge variant="outline" className="text-xs">
                                From Role
                              </Badge>
                            )}
                          </div>
                          {perm.description && (
                            <p className="text-xs text-muted-foreground">{perm.description}</p>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {perm.code}
                          </Badge>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedUserId && (
          <div className="flex justify-end border-t pt-4">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-[#DEDC00] text-[#1C2533] hover:bg-[#F8AB08]"
            >
              {isSaving ? 'Saving...' : 'Save Overrides'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

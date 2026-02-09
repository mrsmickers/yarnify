import { createContext, useContext, useEffect, useState, type ReactNode, useCallback } from 'react'
import { axiosInstance, handleApiError } from '@/api/axios-instance'
import { useCurrentUser } from '@/hooks/useCurrentUser'

type PermissionContextType = {
  permissions: string[]
  hasPermission: (code: string) => boolean
  hasAnyPermission: (...codes: string[]) => boolean
  hasAllPermissions: (...codes: string[]) => boolean
  isLoading: boolean
  error: string | null
  refetch: () => void
}

const PermissionContext = createContext<PermissionContextType | null>(null)

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { data: currentUser, isLoading: userLoading } = useCurrentUser()
  const [permissions, setPermissions] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPermissions = useCallback(async () => {
    if (!currentUser) {
      setPermissions([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      const data = await axiosInstance<string[]>({
        url: '/api/v1/permissions/me',
        method: 'GET',
      })
      setPermissions(data)
    } catch (err) {
      setError(handleApiError(err))
      setPermissions([])
    } finally {
      setIsLoading(false)
    }
  }, [currentUser])

  useEffect(() => {
    if (!userLoading) {
      fetchPermissions()
    }
  }, [userLoading, fetchPermissions])

  const hasPermission = useCallback(
    (code: string) => permissions.includes(code),
    [permissions]
  )

  const hasAnyPermission = useCallback(
    (...codes: string[]) => codes.some((code) => permissions.includes(code)),
    [permissions]
  )

  const hasAllPermissions = useCallback(
    (...codes: string[]) => codes.every((code) => permissions.includes(code)),
    [permissions]
  )

  return (
    <PermissionContext.Provider
      value={{
        permissions,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        isLoading: isLoading || userLoading,
        error,
        refetch: fetchPermissions,
      }}
    >
      {children}
    </PermissionContext.Provider>
  )
}

export function usePermissions() {
  const context = useContext(PermissionContext)
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider')
  }
  return context
}

// Convenience hook for checking a single permission
export function useHasPermission(code: string) {
  const { hasPermission, isLoading } = usePermissions()
  return { hasPermission: hasPermission(code), isLoading }
}

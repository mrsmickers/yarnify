import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query'
import { axiosInstance, handleApiError } from '@/api/axios-instance'

export type CurrentUser = {
  userId: string
  email: string | null
  name: string | null
  tenantId: string | null
  roles: string[]
  department: string | null
}

const CURRENT_USER_QUERY_KEY = ['current-user'] as const

const fetchCurrentUser = async (): Promise<CurrentUser> => {
  try {
    return await axiosInstance<CurrentUser>({
      url: '/api/v1/auth/profile',
      method: 'GET',
    })
  } catch (error) {
    throw new Error(handleApiError(error))
  }
}

export const useCurrentUser = (
  options?: Partial<UseQueryOptions<CurrentUser, Error>>,
): UseQueryResult<CurrentUser, Error> =>
  useQuery<CurrentUser, Error>({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: fetchCurrentUser,
    staleTime: 60_000,
    ...options,
  })

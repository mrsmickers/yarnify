import Axios, {
  AxiosError,
  AxiosHeaders,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
} from 'axios'

const AXIOS_INSTANCE = Axios.create({
  withCredentials: true, // Crucial for sending cookies
})

// Flag to prevent infinite refresh loops
let isRefreshing = false
let failedQueue: Array<{
  resolve: (value?: unknown) => void
  reject: (reason?: unknown) => void
}> = []

const processQueue = (error: Error | null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error)
    } else {
      promise.resolve()
    }
  })
  failedQueue = []
}

// Optional: Request interceptor (e.g., for logging)
AXIOS_INSTANCE.interceptors.request.use(
  (config) => {
    // console.log('Starting Request:', config);
    return config
  },
  (error: AxiosError) => {
    // Use AxiosError for better type safety
    // console.error('Request Error:', error);
    return Promise.reject(error)
  }
)

// Optional: Response interceptor (e.g., for global error handling like 401)
AXIOS_INSTANCE.interceptors.response.use(
  (response: AxiosResponse) => {
    // Use AxiosResponse
    // console.log('Response:', response);
    return response
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If a refresh is already in progress, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then(() => AXIOS_INSTANCE(originalRequest))
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        // Attempt to refresh the token
        await AXIOS_INSTANCE({
          url: '/api/v1/auth/refresh',
          method: 'GET',
        })

        // If refresh successful, process queue and retry original request
        processQueue(null)
        isRefreshing = false
        return AXIOS_INSTANCE(originalRequest)
      } catch (refreshError) {
        // If refresh failed, process queue with error and redirect to login
        processQueue(refreshError as Error)
        isRefreshing = false
        window.location.href = '/api/v1/auth/login'
        return Promise.reject(refreshError)
      }
    }
    return Promise.reject(error)
  }
)

// Export as a function for Orval that makes the request and returns data
export const axiosInstance = <T>(
  config: Partial<InternalAxiosRequestConfig> | Record<string, unknown>
): Promise<T> => {
  // Create a base headers object that can accept plain objects
  const baseHeadersObject: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // If config has headers, merge them
  if (config.headers) {
    if (config.headers instanceof AxiosHeaders) {
      // Convert AxiosHeaders to plain object first
      const headerEntries = Object.entries(config.headers.toJSON())
      headerEntries.forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          baseHeadersObject[key] = String(value)
        }
      })
    } else {
      // Merge plain object headers
      Object.entries(config.headers as Record<string, unknown>).forEach(
        ([key, value]) => {
          if (value !== undefined && value !== null) {
            baseHeadersObject[key] = String(value)
          }
        }
      )
    }
  }

  const requestConfig: InternalAxiosRequestConfig = {
    ...config,
    headers: new AxiosHeaders(baseHeadersObject),
  } as InternalAxiosRequestConfig

  return AXIOS_INSTANCE(requestConfig).then(({ data }) => data)
}

// Generic error handler
export const handleApiError = (error: unknown): string => {
  if (Axios.isAxiosError(error)) {
    if (error.response) {
      const apiError = error.response.data as { message?: string | string[] }
      if (apiError.message) {
        return Array.isArray(apiError.message)
          ? apiError.message.join(', ')
          : apiError.message
      }
      return `Error: ${error.response.status}`
    }
    return error.message
  }
  return 'An unexpected error occurred'
}

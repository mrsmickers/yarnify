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

// =======================
// SECURE SESSION MANAGEMENT
// =======================
// For sensitive data (call recordings, transcriptions) with UK GDPR compliance:
// - Idle timeout: 15 minutes of inactivity → automatic logout
// - Absolute timeout: 24 hours maximum session → forced re-login
// - Proactive refresh: Keep session alive during active use

// Configurable timeouts (can be made env vars later)
const IDLE_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes idle = logout
const IDLE_WARNING_MS = 14 * 60 * 1000 // Warn at 14 minutes
const TOKEN_REFRESH_INTERVAL_MS = 55 * 60 * 1000 // Refresh token every 55 min
const ABSOLUTE_SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000 // 24 hours max session

let refreshTimer: ReturnType<typeof setTimeout> | null = null
let idleTimer: ReturnType<typeof setTimeout> | null = null
let idleWarningTimer: ReturnType<typeof setTimeout> | null = null
let sessionStartTime: number | null = null

/**
 * Check if session has exceeded absolute timeout (24 hours).
 * This is enforced client-side; backend also validates via JWT timestamp.
 */
const isSessionExpired = (): boolean => {
  if (!sessionStartTime) return false
  return Date.now() - sessionStartTime > ABSOLUTE_SESSION_TIMEOUT_MS
}

/**
 * Force logout and clear all timers.
 * Used for idle timeout, absolute timeout, or manual logout.
 */
const forceLogout = (reason: string) => {
  console.log(`[Session] Logging out: ${reason}`)
  
  // Clear all timers
  if (refreshTimer) clearTimeout(refreshTimer)
  if (idleTimer) clearTimeout(idleTimer)
  if (idleWarningTimer) clearTimeout(idleWarningTimer)
  
  // Clear session state
  sessionStartTime = null
  
  // Redirect to login
  window.location.href = '/api/v1/auth/login'
}

/**
 * Show warning dialog before idle timeout.
 * Gives user 1 minute to move mouse/click to stay logged in.
 */
const showIdleWarning = () => {
  console.log('[Session] Idle warning: You will be logged out in 1 minute due to inactivity')
  
  // TODO: Show a modal/toast notification
  // For now, just log. You can add a UI component later:
  // Example: toast.warning('You will be logged out in 1 minute due to inactivity. Move your mouse to stay logged in.')
  
  // Optional: Use window.confirm (blocks UI, not ideal but functional)
  // const userResponded = window.confirm('You will be logged out in 1 minute due to inactivity. Click OK to stay logged in.')
  // if (userResponded) {
  //   resetIdleTimers()
  // }
}

/**
 * Reset idle detection timers.
 * Called on any user activity (mouse, keyboard, API calls).
 */
const resetIdleTimers = () => {
  // Clear existing idle timers
  if (idleTimer) clearTimeout(idleTimer)
  if (idleWarningTimer) clearTimeout(idleWarningTimer)
  
  // Check absolute timeout first
  if (isSessionExpired()) {
    forceLogout('Absolute session timeout (24 hours)')
    return
  }
  
  // Set warning timer (14 minutes)
  idleWarningTimer = setTimeout(() => {
    showIdleWarning()
  }, IDLE_WARNING_MS)
  
  // Set logout timer (15 minutes)
  idleTimer = setTimeout(() => {
    forceLogout('Idle timeout (15 minutes)')
  }, IDLE_TIMEOUT_MS)
}

/**
 * Proactively refresh the access token before it expires.
 * Only refreshes during active sessions (not if idle or expired).
 */
const refreshTokenProactively = async () => {
  // Don't refresh if already refreshing
  if (isRefreshing) {
    console.log('[TokenRefresh] Refresh already in progress, skipping')
    return
  }

  // Check absolute session timeout before refreshing
  if (isSessionExpired()) {
    forceLogout('Absolute session timeout (24 hours)')
    return
  }

  try {
    console.log('[TokenRefresh] Proactively refreshing token...')
    await AXIOS_INSTANCE({
      url: '/api/v1/auth/refresh',
      method: 'GET',
    })
    console.log('[TokenRefresh] Token refreshed successfully')
    
    // Reset idle timers on successful refresh (counts as activity)
    resetIdleTimers()
    
    // Schedule next refresh
    scheduleTokenRefresh()
  } catch (error) {
    console.error('[TokenRefresh] Failed to refresh token:', error)
    // Don't redirect here - let the reactive 401 handler deal with it
  }
}

/**
 * Schedule the next token refresh.
 * Keeps session alive during active use.
 */
const scheduleTokenRefresh = () => {
  if (refreshTimer) clearTimeout(refreshTimer)
  
  refreshTimer = setTimeout(() => {
    refreshTokenProactively()
  }, TOKEN_REFRESH_INTERVAL_MS)
  
  console.log(`[TokenRefresh] Next refresh scheduled in ${TOKEN_REFRESH_INTERVAL_MS / 1000 / 60} minutes`)
}

/**
 * Initialize session management.
 * Starts timers and activity tracking.
 */
const initializeSessionManagement = () => {
  // Set session start time (approximate - actual start is on backend)
  if (!sessionStartTime) {
    sessionStartTime = Date.now()
    console.log('[Session] Session started')
  }
  
  // Start idle detection
  resetIdleTimers()
  
  // Start proactive token refresh
  scheduleTokenRefresh()
  
  // Track user activity to reset idle timer
  if (typeof document !== 'undefined') {
    // Mouse movement
    document.addEventListener('mousemove', resetIdleTimers, { passive: true })
    // Keyboard input
    document.addEventListener('keypress', resetIdleTimers, { passive: true })
    // Mouse clicks
    document.addEventListener('click', resetIdleTimers, { passive: true })
    // Touch events (mobile)
    document.addEventListener('touchstart', resetIdleTimers, { passive: true })
    
    // Handle visibility changes (tab switching)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('[Session] Tab became visible, checking session validity')
        
        // Check if session expired while tab was hidden
        if (isSessionExpired()) {
          forceLogout('Absolute session timeout (24 hours) - detected on tab focus')
          return
        }
        
        // Reset idle timers (user is back)
        resetIdleTimers()
        
        // Trigger immediate token refresh if needed
        refreshTokenProactively()
      }
    })
  }
  
  console.log('[Session] Security timers configured:')
  console.log(`  - Idle timeout: ${IDLE_TIMEOUT_MS / 1000 / 60} minutes`)
  console.log(`  - Idle warning: ${IDLE_WARNING_MS / 1000 / 60} minutes`)
  console.log(`  - Absolute timeout: ${ABSOLUTE_SESSION_TIMEOUT_MS / 1000 / 60 / 60} hours`)
  console.log(`  - Token refresh: ${TOKEN_REFRESH_INTERVAL_MS / 1000 / 60} minutes`)
}

// Initialize session management when module loads
initializeSessionManagement()

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
      const apiError = error.response.data as { 
        message?: string | string[] 
        error?: string | string[]
        issues?: Array<{ path: (string | number)[]; message: string }>
      }
      
      // Handle Zod validation errors (from nestjs-zod)
      if (apiError.issues && Array.isArray(apiError.issues)) {
        const messages = apiError.issues.map((issue) => {
          const path = issue.path.join('.')
          return path ? `${path}: ${issue.message}` : issue.message
        })
        return messages.join(', ')
      }
      
      // Handle standard error messages
      if (apiError.message) {
        return Array.isArray(apiError.message)
          ? apiError.message.join(', ')
          : apiError.message
      }
      
      // Handle error field (NestJS default)
      if (apiError.error) {
        return Array.isArray(apiError.error)
          ? apiError.error.join(', ')
          : apiError.error
      }
      
      return `Error: ${error.response.status}`
    }
    return error.message
  }
  return 'An unexpected error occurred'
}

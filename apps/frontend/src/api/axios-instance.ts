import Axios, {
  AxiosError,
  AxiosHeaders,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
} from 'axios'

// ===========================
// STAGING KEY BYPASS
// ===========================
const STAGING_KEY_STORAGE_KEY = 'staging_api_key'

/**
 * Get staging key from build-time env var.
 * Set VITE_STAGING_KEY in Coolify for staging builds.
 */
const getEnvStagingKey = (): string | null => {
  try {
    const key = import.meta.env.VITE_STAGING_KEY
    return key && typeof key === 'string' ? key : null
  } catch {
    return null
  }
}

/**
 * Check for staging key in URL hash on page load.
 * Format: /#staging=KEY or ?staging_key=KEY
 * Also checks build-time VITE_STAGING_KEY env var.
 */
const checkForStagingKey = () => {
  if (typeof window === 'undefined') return

  // Check build-time env var first (most reliable for staging builds)
  const envKey = getEnvStagingKey()
  if (envKey) {
    console.log('[Staging] Key detected in VITE_STAGING_KEY env var')
    localStorage.setItem(STAGING_KEY_STORAGE_KEY, envKey)
    return // Don't check URL if env var is set
  }

  // Check hash: /#staging=KEY
  const hash = window.location.hash
  if (hash.startsWith('#staging=')) {
    const key = hash.slice('#staging='.length)
    if (key) {
      console.log('[Staging] Key detected in URL hash')
      localStorage.setItem(STAGING_KEY_STORAGE_KEY, key)
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      return
    }
  }

  // Also check query param: ?staging_key=KEY
  const params = new URLSearchParams(window.location.search)
  const keyParam = params.get('staging_key')
  if (keyParam) {
    console.log('[Staging] Key detected in query param')
    localStorage.setItem(STAGING_KEY_STORAGE_KEY, keyParam)
    params.delete('staging_key')
    const newSearch = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (newSearch ? '?' + newSearch : ''))
  }
}

/**
 * Get the current staging key (if any).
 * Checks localStorage (persisted from URL/env) or falls back to env var.
 */
export const getStagingKey = (): string | null => {
  if (typeof window === 'undefined') return getEnvStagingKey()
  return localStorage.getItem(STAGING_KEY_STORAGE_KEY) || getEnvStagingKey()
}

/**
 * Check if we're in staging bypass mode.
 */
export const isStagingMode = (): boolean => {
  return getStagingKey() !== null
}

/**
 * Clear staging key (only clears localStorage, not env var).
 */
export const clearStagingKey = () => {
  localStorage.removeItem(STAGING_KEY_STORAGE_KEY)
}

// Check for staging key on module load (synchronous, before React renders)
checkForStagingKey()

// ===========================
// IMPERSONATION TOKEN HANDLING
// ===========================
const IMPERSONATION_TOKEN_KEY = 'impersonation_token'

/**
 * Check for impersonation token in URL hash on page load.
 * Format: /#impersonate=TOKEN
 */
const checkForImpersonationToken = () => {
  if (typeof window === 'undefined') return

  const hash = window.location.hash
  if (hash.startsWith('#impersonate=')) {
    const token = hash.slice('#impersonate='.length)
    if (token) {
      console.log('[Impersonation] Token detected in URL hash')
      localStorage.setItem(IMPERSONATION_TOKEN_KEY, token)
      // Clean up the URL hash
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }
}

/**
 * Get the current impersonation token (if any).
 */
export const getImpersonationToken = (): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(IMPERSONATION_TOKEN_KEY)
}

/**
 * Check if we're currently impersonating a user.
 */
export const isImpersonating = (): boolean => {
  return getImpersonationToken() !== null
}

/**
 * Clear the impersonation token and close the window.
 */
export const exitImpersonation = () => {
  console.log('[Impersonation] Exiting impersonation mode')
  localStorage.removeItem(IMPERSONATION_TOKEN_KEY)
  // Close the window - if it was opened by impersonation
  if (window.opener) {
    window.close()
  } else {
    // If we can't close (not opened as popup), redirect to home
    window.location.href = '/'
  }
}

// Check for impersonation token on module load
checkForImpersonationToken()

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
let idleRemainingMs: number | null = null // Remaining idle time when tab was hidden
let warningRemainingMs: number | null = null // Remaining warning time when tab was hidden
let lastActivityTime: number = Date.now() // Track when user was last active

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
  
  // Clear any paused state
  idleRemainingMs = null
  warningRemainingMs = null
  
  // Track last activity time
  lastActivityTime = Date.now()
  
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
 * Pause idle timers when tab becomes hidden.
 * Calculates remaining time so we can resume accurately.
 */
const pauseIdleTimers = () => {
  const elapsed = Date.now() - lastActivityTime
  
  // Calculate remaining time for each timer
  const idleRemaining = IDLE_TIMEOUT_MS - elapsed
  const warningRemaining = IDLE_WARNING_MS - elapsed
  
  // Only save remaining time if timer hasn't already fired
  idleRemainingMs = idleRemaining > 0 ? idleRemaining : null
  warningRemainingMs = warningRemaining > 0 ? warningRemaining : null
  
  // Clear the active timers (they won't fire while paused)
  if (idleTimer) clearTimeout(idleTimer)
  if (idleWarningTimer) clearTimeout(idleWarningTimer)
  idleTimer = null
  idleWarningTimer = null
  
  console.log(`[Session] Idle timers paused (${Math.round((idleRemaining) / 1000)}s remaining)`)
}

/**
 * Resume idle timers when tab becomes visible again.
 * Uses the remaining time from when we paused.
 */
const resumeIdleTimers = () => {
  // Check absolute timeout first
  if (isSessionExpired()) {
    forceLogout('Absolute session timeout (24 hours) - detected on tab focus')
    return
  }
  
  // If we have paused state, resume with remaining time
  if (idleRemainingMs !== null && idleRemainingMs > 0) {
    console.log(`[Session] Resuming idle timers (${Math.round(idleRemainingMs / 1000)}s remaining)`)
    
    if (warningRemainingMs !== null && warningRemainingMs > 0) {
      idleWarningTimer = setTimeout(() => {
        showIdleWarning()
      }, warningRemainingMs)
    }
    
    idleTimer = setTimeout(() => {
      forceLogout('Idle timeout (15 minutes)')
    }, idleRemainingMs)
    
    // Clear paused state
    idleRemainingMs = null
    warningRemainingMs = null
  } else {
    // No paused state (or timer already expired) — treat return as new activity
    resetIdleTimers()
  }
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
 * Disabled when impersonating (impersonation tokens have their own 30-min expiry).
 */
const initializeSessionManagement = () => {
  // Skip session management when using staging key bypass
  if (isStagingMode()) {
    console.log('[Session] Skipping session management - staging mode active')
    return
  }

  // Skip session management when impersonating
  // Impersonation tokens have their own 30-minute expiry and can't be refreshed
  if (isImpersonating()) {
    console.log('[Session] Skipping session management - impersonation mode active')
    console.log('[Session] Impersonation token will expire in 30 minutes')
    return
  }

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
      if (document.visibilityState === 'hidden') {
        // Tab hidden — pause idle timers so they don't fire in the background
        pauseIdleTimers()
      } else if (document.visibilityState === 'visible') {
        console.log('[Session] Tab became visible, checking session validity')
        
        // Resume idle timers with remaining time (doesn't reset the clock)
        resumeIdleTimers()
        
        // Trigger token refresh if needed (token may have expired while away)
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

// Request interceptor - add staging key or impersonation token if present
AXIOS_INSTANCE.interceptors.request.use(
  (config) => {
    config.headers = config.headers || new AxiosHeaders()

    // If we have a staging key, add it to bypass auth
    const stagingKey = getStagingKey()
    if (stagingKey) {
      config.headers.set('X-Staging-Key', stagingKey)
      // Don't send cookies when using staging key
      config.withCredentials = false
      return config
    }

    // If we have an impersonation token, use it instead of cookies
    const impersonationToken = getImpersonationToken()
    if (impersonationToken) {
      config.headers.set('Authorization', `Bearer ${impersonationToken}`)
      // Don't send cookies when impersonating - use token auth only
      config.withCredentials = false
    }
    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  }
)

// Response interceptor - handle 401 errors (with special handling for impersonation)
AXIOS_INSTANCE.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      // If we're using staging key and get a 401, the key is invalid
      // Don't redirect - just reject so we can see the error
      if (isStagingMode()) {
        console.error('[Staging] Auth failed - staging key may be invalid')
        return Promise.reject(error)
      }

      // If we're impersonating and get a 401, the impersonation token expired
      // Exit impersonation mode - don't try to refresh
      if (isImpersonating()) {
        console.log('[Impersonation] Token expired, exiting impersonation mode')
        exitImpersonation()
        return Promise.reject(error)
      }

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

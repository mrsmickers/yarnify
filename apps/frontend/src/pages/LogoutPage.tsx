import { useEffect, useState } from 'react'
import axiosInstance from '@/api/axios-instance'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

const LogoutPage = () => {
  const [status, setStatus] = useState<'logging-out' | 'done' | 'error'>('logging-out')

  useEffect(() => {
    const doLogout = async () => {
      try {
        // Call the logout endpoint to clear server-side session
        await axiosInstance.post('/auth/logout')
        setStatus('done')
        
        // Clear any local storage items related to auth
        localStorage.removeItem('oracle_impersonation_token')
        
        // Redirect to login page after a brief delay
        setTimeout(() => {
          window.location.href = '/api/v1/auth/login'
        }, 1500)
      } catch (error) {
        console.error('Logout failed:', error)
        setStatus('error')
        // Still redirect on error - user wants to leave
        setTimeout(() => {
          window.location.href = '/api/v1/auth/login'
        }, 2000)
      }
    }
    
    doLogout()
  }, [])

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md border border-border/80 bg-card/70 p-8 text-center shadow-lg dark:border-[#242F3F]">
        <CardHeader className="space-y-3 text-center">
          <CardTitle className="text-2xl font-semibold">
            {status === 'logging-out' && 'Signing you out…'}
            {status === 'done' && 'Signed out'}
            {status === 'error' && 'Session ended'}
          </CardTitle>
          <CardDescription>
            {status === 'logging-out' && "Thank you for using The Oracle. We'll redirect you in a moment."}
            {status === 'done' && 'Your session has been closed securely. Redirecting to login...'}
            {status === 'error' && 'There was an issue, but we\'re redirecting you to login...'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
          {status === 'logging-out' && <Loader2 className="h-6 w-6 animate-spin text-[#DEDC00]" />}
          {status === 'done' && <p className="text-green-500">✓ Logged out successfully</p>}
          {status === 'error' && <p className="text-amber-500">Redirecting...</p>}
        </CardContent>
      </Card>
    </div>
  )
}

export default LogoutPage

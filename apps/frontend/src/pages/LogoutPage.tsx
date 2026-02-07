import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

const LogoutPage = () => {
  const navigate = useNavigate()

  useEffect(() => {
    // Navigate back to home page after a brief delay to allow for animations/messages
    const timer = setTimeout(() => {
      navigate('/', { replace: true })
    }, 1500)

    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md border border-border/80 bg-card/70 p-8 text-center shadow-lg dark:border-[#242F3F]">
        <CardHeader className="space-y-3 text-center">
          <CardTitle className="text-2xl font-semibold">
            Signing you out…
          </CardTitle>
          <CardDescription>
            Thank you for using The Oracle. We&apos;ll redirect you in a moment.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-[#DEDC00]" />
          <p>Your session is closing securely.</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default LogoutPage

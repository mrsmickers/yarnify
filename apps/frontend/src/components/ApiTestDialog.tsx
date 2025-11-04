import { useState } from 'react'
import { X, CheckCircle2, XCircle, Loader2, Server, Brain, Phone, Wifi } from 'lucide-react'
import { Button } from './ui/button'
import { useSystemControllerTestApiConnections } from '../api/api-client'

interface ApiStatus {
  status: 'success' | 'error' | 'unknown'
  message: string
  responseTime: number
}

interface ApiTestResults {
  local: ApiStatus
  connectwise: ApiStatus
  openai: ApiStatus
  voip: ApiStatus
}

interface ApiTestDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function ApiTestDialog({ isOpen, onClose }: ApiTestDialogProps) {
  const [testResults, setTestResults] = useState<ApiTestResults | null>(null)
  const testApiMutation = useSystemControllerTestApiConnections()

  if (!isOpen) return null

  const handleTestApis = async () => {
    setTestResults(null)
    try {
      const result = await testApiMutation.refetch()
      if (result.data) {
        setTestResults(result.data as ApiTestResults)
      }
    } catch (error) {
      console.error('Failed to test APIs:', error)
    }
  }

  const getStatusIcon = (status: string) => {
    if (status === 'success') return <CheckCircle2 className="h-5 w-5 text-green-500" />
    if (status === 'error') return <XCircle className="h-5 w-5 text-red-500" />
    return <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
  }

  const apis = [
    { key: 'local', name: 'Local API', icon: Server },
    { key: 'connectwise', name: 'ConnectWise', icon: Wifi },
    { key: 'openai', name: 'OpenAI', icon: Brain },
    { key: 'voip', name: 'VoIP', icon: Phone },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-background border border-border rounded-lg shadow-lg p-6 mx-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-2xl font-semibold mb-4">API Connection Test</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Test connectivity to all external APIs and services.
        </p>

        <div className="space-y-3 mb-6">
          {apis.map(({ key, name, icon: Icon }) => {
            const result = testResults?.[key as keyof ApiTestResults]
            return (
              <div
                key={key}
                className="flex items-center justify-between p-3 border border-border rounded-md bg-card"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{name}</p>
                    {result && (
                      <p className="text-xs text-muted-foreground">
                        {result.message}
                        {result.responseTime > 0 && ` (${result.responseTime}ms)`}
                      </p>
                    )}
                  </div>
                </div>
                {result && getStatusIcon(result.status)}
              </div>
            )
          })}
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleTestApis}
            disabled={testApiMutation.isFetching}
            className="flex-1"
          >
            {testApiMutation.isFetching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              'Test All Connections'
            )}
          </Button>
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}


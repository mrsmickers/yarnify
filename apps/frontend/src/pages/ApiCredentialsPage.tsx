import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'

const ApiCredentialsPage = () => {
  return (
    <div className="space-y-10">
      <PageHeader
        title="API Credentials"
        description="Manage API keys and credentials for integrations."
      />

      <div className="flex h-[400px] items-center justify-center">
        <Card className="w-full max-w-md border border-border/80 bg-card/70 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="mb-4 text-6xl">🚧</div>
            <h3 className="mb-2 text-2xl font-semibold">Coming Soon</h3>
            <p className="text-muted-foreground">
              API credential management features are currently under development.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default ApiCredentialsPage


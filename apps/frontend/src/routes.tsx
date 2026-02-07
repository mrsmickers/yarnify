import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// Home page component
export const HomePage = () => (
  <div className="space-y-10">
    <PageHeader
      title="Welcome to The Oracle"
      description="Monitor and analyse Ingenio call experiences with AI-powered insights and beautifully structured dashboards."
      actions={
        <Button asChild>
          <Link to="/dashboard">Enter dashboard</Link>
        </Button>
      }
    />
    <Card className="border border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
      <CardHeader>
        <CardTitle>What&apos;s new</CardTitle>
        <CardDescription>
          Explore the redesigned Ingenio experience with a unified navigation system and
          refreshed analytics.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
          <p className="text-sm font-semibold text-foreground">
            Tailored dashboards
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            RBAC-ready workspaces deliver the right intelligence to every team.
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
          <p className="text-sm font-semibold text-foreground">
            Ingenio design system
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            The Oracle now matches Ingenio's navigation rail, spacing, and colour tokens.
          </p>
        </div>
      </CardContent>
    </Card>
  </div>
)

// Not Found page component
export const NotFoundPage = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <Card className="max-w-md border border-border/80 bg-card/70 p-8 text-center shadow-lg dark:border-[#242F3F]">
      <CardHeader className="space-y-3 text-center">
        <CardTitle className="text-2xl font-semibold">Page not found</CardTitle>
        <CardDescription>
          The page you're after has moved or no longer exists. Let's get you back on
          track.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Button asChild>
          <Link to="/">Return home</Link>
        </Button>
      </CardContent>
    </Card>
  </div>
)

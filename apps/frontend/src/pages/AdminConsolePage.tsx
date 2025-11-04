import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { ShieldCheck, Users, KeyRound } from 'lucide-react'

const AdminConsolePage = () => {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Admin Console"
        description="Manage workspace access, integrations, and audit activity to keep Yarnify secure for every Ingenio team."
        actions={
          <Button type="button" className="bg-[#DEDC00] text-[#1C2533] hover:bg-[#F8AB08]">
            Create automation
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {[
          {
            title: 'Role management',
            description:
              'Assign RBAC roles and control which teams can access premium call intelligence.',
            icon: Users,
            action: 'Review members',
          },
          {
            title: 'Security policies',
            description:
              'Enforce MFA, session timeouts, and SOC2-aligned guardrails across the organisation.',
            icon: ShieldCheck,
            action: 'Update policies',
          },
          {
            title: 'API credentials',
            description:
              'Rotate API keys, monitor usage, and integrate Ingenio services with Yarnify.',
            icon: KeyRound,
            action: 'Manage tokens',
          },
        ].map(({ title, description, icon: Icon, action }) => (
          <Card
            key={title}
            className="border border-border/80 bg-card/70 backdrop-blur-sm transition-transform hover:-translate-y-0.5 hover:shadow-[0_24px_48px_-30px_rgba(12,17,27,0.8)] dark:border-[#242F3F]"
          >
            <CardHeader className="space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/40 text-[#DEDC00]">
                <Icon className="h-6 w-6" aria-hidden />
              </div>
              <div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                {action}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default AdminConsolePage

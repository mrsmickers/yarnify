import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Theme, useTheme } from '@/theme/theme-provider'
import { PageHeader } from '@/components/layout/PageHeader'
import { useCurrentUser } from '@/hooks/useCurrentUser'

const THEME_OPTIONS: Array<{
  value: Theme
  title: string
  description: string
}> = [
  {
    value: 'light',
    title: 'Light',
    description: 'Bright appearance with high contrast for well-lit environments.',
  },
  {
    value: 'dark',
    title: 'Dark',
    description: 'Low-light friendly palette that reduces glare and eye strain.',
  },
]

export default function PersonalSettingsPage() {
  const { theme, setTheme } = useTheme()
  const { data: profileData } = useCurrentUser()
  const hasHydratedProfile = useRef(false)
  const fallbackTimezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  const [profile, setProfile] = useState({
    displayName: '',
    jobTitle: '',
    email: '',
    department: '',
    role: '',
    timezone: fallbackTimezone,
  })

  useEffect(() => {
    if (profileData && !hasHydratedProfile.current) {
      setProfile((current) => ({
        ...current,
        displayName: profileData.name ?? current.displayName,
        email: profileData.email ?? current.email,
        department: profileData.department ?? current.department,
        role: profileData.role ?? current.role,
      }))
      hasHydratedProfile.current = true
    }
  }, [profileData])

  const handleProfileChange =
    (field: keyof typeof profile) => (event: ChangeEvent<HTMLInputElement>) => {
      setProfile((current) => ({ ...current, [field]: event.target.value }))
    }

  const handleProfileSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    console.info('Personal settings submitted', profile)
  }

  return (
    <div className="space-y-10">
      <PageHeader
        title="Personal settings"
        description="Update the details that personalise your Yarnify workspace and control how the interface looks while you work."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="border border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
          <form onSubmit={handleProfileSubmit} className="flex flex-col gap-6">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                These details help your teammates recognise you across Yarnify.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  value={profile.displayName}
                  onChange={handleProfileChange('displayName')}
                  placeholder="Your name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={profile.role === 'admin' ? 'Admin' : profile.role === 'user' ? 'User' : ''}
                  disabled
                  className="bg-muted capitalize"
                />
                <p className="text-xs text-muted-foreground">
                  Your role is managed by administrators
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={profile.department ? profile.department.charAt(0).toUpperCase() + profile.department.slice(1) : ''}
                  disabled
                  className="bg-muted capitalize"
                />
                <p className="text-xs text-muted-foreground">
                  Your department is managed by administrators
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={handleProfileChange('email')}
                  placeholder="you@example.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  value={profile.timezone}
                  onChange={handleProfileChange('timezone')}
                  placeholder="Region/City"
                />
              </div>
            </CardContent>
            <CardFooter className="border-t pt-6">
              <Button type="submit">Save changes</Button>
            </CardFooter>
          </form>
        </Card>

        <Card className="border border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              Switch between light and dark modes to match your workspace and reduce eye
              strain.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {THEME_OPTIONS.map((option) => {
                const isActive = theme === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTheme(option.value)}
                    className={cn(
                      'group flex h-full flex-col justify-between rounded-xl border p-4 text-left transition-all',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      isActive
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'hover:border-primary/60 hover:bg-muted/40'
                    )}
                    aria-pressed={isActive}
                    aria-label={`Use ${option.title.toLowerCase()} theme`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <span className="text-base font-medium text-foreground">
                          {option.title}
                        </span>
                        <p className="text-sm text-muted-foreground">
                          {option.description}
                        </p>
                      </div>
                      {isActive && (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-4 w-4" />
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

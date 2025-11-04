import { type ReactNode, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Menu,
  Moon,
  PhoneCall,
  Settings,
  ShieldCheck,
  Sun,
  UserCircle2,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/theme/theme-provider'
import { Button } from '@/components/ui/button'

type AppShellProps = {
  children: ReactNode
}

type NavItem = {
  label: string
  path: string
  icon: LucideIcon
  end?: boolean
}

type NavSection = {
  title: string
  items: NavItem[]
}

const workspaceNav: NavSection = {
  title: 'Workspace',
  items: [
    {
      label: 'VoIP Overview',
      path: '/',
      icon: LayoutDashboard,
      end: true,
    },
    {
      label: 'Call Intelligence',
      path: '/dashboard',
      icon: PhoneCall,
    },
  ],
}

const adminNav: NavSection = {
  title: 'Admin',
  items: [
    {
      label: 'Admin Console',
      path: '/admin',
      icon: ShieldCheck,
    },
  ],
}

export function AppShell({ children }: AppShellProps) {
  const { theme, toggleTheme } = useTheme()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const sidebarStyle = useMemo(
    () => ({
      background:
        theme === 'dark'
          ? 'linear-gradient(180deg, #1C2533 0%, #222E40 100%)'
          : '#FFFFFF',
      borderRightColor: theme === 'dark' ? '#2A3447' : '#E2E8F0',
    }),
    [theme]
  )

  const appBackground = useMemo(
    () => (theme === 'dark' ? '#111827' : '#F9FAFB'),
    [theme]
  )

  const hoverClass =
    theme === 'dark'
      ? 'hover:bg-[rgba(255,255,255,0.08)]'
      : 'hover:bg-[#F3F4F6]'

  const activeForeground = theme === 'dark' ? '#1C2533' : '#222E40'

  const toggleCollapse = () => setIsCollapsed((previous) => !previous)

  const closeMobileSidebar = () => setIsMobileOpen(false)

  const renderNavSection = (section: NavSection) => (
    <div key={section.title} className="space-y-2">
      <p
        className={cn(
          'text-xs font-semibold uppercase tracking-[0.18em] text-white/60 transition-opacity',
          theme === 'light' && 'text-sidebar-foreground opacity-70',
          isCollapsed && 'opacity-0'
        )}
        aria-hidden={isCollapsed}
      >
        {section.title}
      </p>
      <div className="space-y-1">
        {section.items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            onClick={closeMobileSidebar}
            aria-label={isCollapsed ? item.label : undefined}
            title={isCollapsed ? item.label : undefined}
          >
            {({ isActive }) => (
              <div
                className={cn(
                  'group relative flex items-center rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  hoverClass,
                  isCollapsed ? 'justify-center px-2' : 'gap-3',
                  isActive && 'opacity-100 shadow-sm'
                )}
                style={
                  isActive
                    ? {
                        backgroundColor: 'var(--accent)',
                        color: activeForeground,
                      }
                    : undefined
                }
              >
                <item.icon
                  className={cn(
                    'h-5 w-5 shrink-0',
                    !isActive && 'text-white/80',
                    theme === 'light' && !isActive && 'text-sidebar-foreground',
                    isActive && (theme === 'dark' ? 'text-[#1C2533]' : 'text-[#222E40]')
                  )}
                  aria-hidden
                />
                {!isCollapsed && (
                  <span
                    className={cn(
                      'whitespace-nowrap transition-all',
                      !isActive && 'text-white/80',
                      theme === 'light' && !isActive && 'text-sidebar-foreground'
                    )}
                  >
                    {item.label}
                  </span>
                )}
              </div>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  )

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          'flex items-center',
          isCollapsed ? 'justify-center px-3 py-6' : 'justify-between px-4 py-8'
        )}
      >
        {!isCollapsed && (
          <>
            <NavLink
              to="/"
              className="flex items-center gap-3 font-semibold tracking-tight text-white dark:text-white"
              onClick={closeMobileSidebar}
            >
              <span className="text-lg font-semibold">Yarnify</span>
            </NavLink>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 text-white/70 hover:text-white',
                theme === 'light' && 'text-sidebar-foreground hover:text-sidebar-foreground'
              )}
              onClick={toggleCollapse}
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </>
        )}
        {isCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-8 text-white/70 hover:text-white',
              theme === 'light' && 'text-sidebar-foreground hover:text-sidebar-foreground'
            )}
            onClick={toggleCollapse}
            aria-label="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      <nav
        className={cn(
          'flex-1 space-y-8 overflow-y-auto px-3',
          !isCollapsed && 'pr-4'
        )}
        aria-label="Primary"
      >
        {renderNavSection(workspaceNav)}
        {renderNavSection(adminNav)}
      </nav>

      <div
        className={cn(
          'mt-6 border-t border-white/10 px-3 py-6',
          theme === 'light' && 'border-[#E2E8F0]'
        )}
      >
        <div
          className={cn(
            'flex items-center gap-3 rounded-xl bg-white/5 px-3 py-3',
            theme === 'light' && 'bg-[#F3F4F6]'
          )}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white">
            <UserCircle2 className="h-6 w-6" aria-hidden />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white dark:text-white">
                Jordan Smith
              </p>
              <NavLink
                to="/settings"
                className={cn(
                  'text-xs font-medium text-[#DEDC00] transition-colors hover:text-[#F8AB08]',
                  theme === 'light' && 'text-[#824192] hover:text-[#9C4BB3]'
                )}
                onClick={closeMobileSidebar}
              >
                View preferences
              </NavLink>
            </div>
          )}
        </div>
        <div
          className={cn(
            'mt-3 flex items-center justify-between rounded-xl px-3 py-3 text-sm text-white',
            theme === 'light' && 'text-sidebar-foreground'
          )}
        >
          {!isCollapsed && <span>Theme</span>}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className={cn(
              'h-9 w-9 rounded-full border border-white/10 bg-white/5 text-white/80 transition-colors hover:text-white',
              theme === 'light' &&
                'border-[#E2E8F0] bg-white text-sidebar-foreground hover:text-sidebar-foreground'
            )}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </div>
        {!isCollapsed && (
          <NavLink
            to="/settings"
            onClick={closeMobileSidebar}
            className={cn(
              'mt-3 flex items-center gap-3 rounded-xl border border-white/10 px-3 py-3 text-sm font-medium text-white transition-colors hover:border-[#DEDC00]',
              theme === 'light' &&
                'border-[#E2E8F0] text-sidebar-foreground hover:border-[#824192]'
            )}
          >
            <Settings className="h-5 w-5 shrink-0" aria-hidden />
            <span>Workspace preferences</span>
          </NavLink>
        )}
      </div>
    </div>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        className="fixed left-5 bottom-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-[#1C2533] text-white shadow-xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DEDC00] md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-6 w-6" aria-hidden />
      </button>

      {isMobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeMobileSidebar}
            aria-hidden
          />
          <aside
            className="relative flex h-full w-72 flex-col border-r border-[#1F2937] p-6 shadow-xl"
            style={sidebarStyle}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={closeMobileSidebar}
              className="absolute right-4 top-4 h-8 w-8 text-white/70 hover:text-white"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" aria-hidden />
            </Button>
            {sidebarContent}
          </aside>
        </div>
      )}

      <div
        className="flex min-h-screen w-full"
        style={{ background: appBackground }}
      >
        <aside
          className={cn(
            'relative z-30 hidden shrink-0 border-r shadow-lg md:block',
            isCollapsed ? 'w-[4.25rem]' : 'w-64'
          )}
          style={sidebarStyle}
        >
          {sidebarContent}
        </aside>
        <div className="flex min-h-screen flex-1 flex-col">
          <main className="flex-1 px-4 py-8 sm:px-6 lg:px-10">
            <div className="mx-auto w-full max-w-6xl space-y-10">{children}</div>
          </main>
        </div>
      </div>
    </>
  )
}

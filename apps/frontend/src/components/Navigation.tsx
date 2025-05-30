import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { useAuthControllerLogout } from '../api/api-client'
import { Button } from './ui/button'

export function Navigation() {
  const navigate = useNavigate()
  const logout = useAuthControllerLogout()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleSignOut = async () => {
    try {
      await logout.mutateAsync()
      // Clear any client-side state here if needed
      navigate('/logout', { replace: true })
    } catch (error) {
      console.error('Error signing out:', error)
      // Show an error notification or handle error appropriately
    }
  }

  return (
    <nav className="sticky top-0 z-50 bg-background/95 border-b border-border/40 backdrop-blur-sm shadow-sm w-full">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-24 flex items-center justify-between">
          <div className="flex items-center">
            <NavLink to="/" className="flex-shrink-0">
              <img
                src="/cj-logo.png"
                alt="Speek It Logo"
                className="hidden sm:block h-[60px]"
              />
              <img
                src="/cj-logo-sm.png"
                alt="Speek It Logo"
                className="h-12 sm:hidden"
              />
            </NavLink>
          </div>
          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `text-sm font-medium transition-colors hover:text-primary ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`
              }
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Home
            </NavLink>
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `text-sm font-medium transition-colors hover:text-primary ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`
              }
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Dashboard
            </NavLink>
            <Button
              variant="ghost"
              size="sm"
              className="text-sm font-medium text-muted-foreground hover:text-primary"
              onClick={() => {
                handleSignOut()
                setIsMobileMenuOpen(false)
              }}
            >
              Sign out
            </Button>
          </div>
          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>
      </div>
      {/* Mobile Menu */}
      <div
        className={`
          md:hidden absolute top-24 left-0 right-0 bg-background/95 border-t border-border/40 shadow-lg backdrop-blur-sm
          transition-all duration-300 ease-in-out transform
          ${
            isMobileMenuOpen
              ? 'translate-y-0 opacity-100'
              : '-translate-y-full opacity-0 pointer-events-none'
          }
        `}
      >
        {isMobileMenuOpen && (
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-base font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-foreground'
                }`
              }
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Home
            </NavLink>
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-base font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-foreground'
                }`
              }
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Dashboard
            </NavLink>
            <Button
              variant="secondary" // More prominent for sign out on mobile
              className="w-full justify-start px-3 py-2 rounded-md text-base font-medium"
              onClick={() => {
                handleSignOut()
                setIsMobileMenuOpen(false)
              }}
            >
              Sign out
            </Button>
          </div>
        )}
      </div>
    </nav>
  )
}

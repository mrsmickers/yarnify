import { Link, useNavigate } from 'react-router-dom'
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
    <nav className="sticky top-0 z-50 bg-white/90 border-b border-gray-200 backdrop-blur-sm shadow-sm w-full">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-20 flex items-center justify-between">
          {' '}
          {/* Adjusted height for a more standard navbar */}
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0">
              <img
                src="/cj-logo.png"
                alt="Speek It Logo"
                className="hidden sm:block h-12" // Adjusted height
              />
              <img
                src="/cj-logo-sm.png"
                alt="Speek It Logo"
                className="h-10 sm:hidden" // Adjusted height
              />
            </Link>
          </div>
          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/"
              className="text-gray-600 hover:text-gray-900 transition-colors duration-200 font-medium"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              to="/dashboard"
              className="text-gray-600 hover:text-gray-900 transition-colors duration-200 font-medium"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Button
              variant="outline"
              size="sm"
              className="text-gray-600 hover:text-gray-900"
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
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-20 left-0 right-0 bg-white/95 border-t border-b border-gray-200 shadow-lg backdrop-blur-sm">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <Link
              to="/"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              to="/dashboard"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Button
              variant="ghost"
              className="w-full justify-start px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
              onClick={() => {
                handleSignOut()
                setIsMobileMenuOpen(false)
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      )}
    </nav>
  )
}

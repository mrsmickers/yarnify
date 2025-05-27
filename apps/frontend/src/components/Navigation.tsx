import { Link, useNavigate } from 'react-router-dom'
import { useAuthControllerLogout } from '../api/api-client'
import { Button } from './ui/button'

export function Navigation() {
  const navigate = useNavigate()
  const logout = useAuthControllerLogout()

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
      <div className="max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="h-32 flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <img
              src="/logo.png"
              alt="Speek It Logo"
              className="hidden sm:block sm:h-20"
            />
            <img
              src="/logo-sm.png"
              alt="Speek It Logo"
              className="h-12 sm:hidden"
            />
          </div>
          <div className="flex items-center gap-6">
            <Link
              to="/"
              className="text-gray-600 hover:text-gray-900 transition-colors duration-200 font-medium"
            >
              Home
            </Link>
            <Link
              to="/dashboard"
              className="text-gray-600 hover:text-gray-900 transition-colors duration-200 font-medium"
            >
              Dashboard
            </Link>
            <Button
              variant="outline"
              size="sm"
              className="text-gray-600 hover:text-gray-900"
              onClick={handleSignOut}
            >
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}

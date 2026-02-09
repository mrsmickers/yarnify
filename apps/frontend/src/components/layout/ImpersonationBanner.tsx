import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ImpersonationBannerProps = {
  displayName: string | null
  role: string | null
  onExit: () => void
}

/**
 * Sticky banner displayed at the top of the viewport when an admin is impersonating another user.
 * Shows the impersonated user's name and role, with an exit button to end the session.
 */
export function ImpersonationBanner({ displayName, role, onExit }: ImpersonationBannerProps) {
  const roleDisplay = role ? role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ') : 'User'

  return (
    <div className="sticky top-0 z-[100] flex items-center justify-center gap-3 bg-[#F8AB08] px-4 py-2 text-sm font-medium text-[#222E40]">
      <span className="flex items-center gap-2">
        <span className="text-lg">👁</span>
        <span>
          Viewing as{' '}
          <strong>{displayName || 'Unknown User'}</strong>
          {' '}({roleDisplay})
        </span>
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={onExit}
        className="ml-2 h-7 gap-1 bg-[#222E40]/10 px-2 text-[#222E40] hover:bg-[#222E40]/20 hover:text-[#222E40]"
      >
        <X className="h-4 w-4" />
        Exit Impersonation
      </Button>
    </div>
  )
}

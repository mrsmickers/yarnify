import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type PageHeaderProps = {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <section
      className={cn(
        'w-full rounded-2xl border border-[#E2E8F0] bg-white px-6 py-6 shadow-[0_24px_48px_-32px_rgba(34,46,64,0.45)] transition-colors md:px-8 md:py-8',
        'dark:border-[#242F3F] dark:bg-[#1F2937] dark:shadow-[0_24px_48px_-32px_rgba(12,17,27,0.85)]',
        className
      )}
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[#222E40] dark:text-white md:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-sm text-[#4F5D72] dark:text-white/70 md:text-base">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-col gap-3 text-sm md:flex-row md:items-center md:gap-3">
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  )
}

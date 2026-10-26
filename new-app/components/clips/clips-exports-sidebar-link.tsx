'use client'

import Link from 'next/link'
import { Download } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Left-sidebar Exports entry (explicit Link — avoids broken compact-nav clicks from editor). */
export function ClipsExportsSidebarLink({
  compact,
  active,
  onNavigate,
}: {
  compact?: boolean
  active: boolean
  onNavigate?: () => void
}) {
  return (
    <Link
      href="/app/exports"
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      title={compact ? 'Exports' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
        active && 'bg-sidebar-accent text-sidebar-accent-foreground',
        compact && 'flex-col gap-1 px-1 py-2',
      )}
    >
      <span className={cn('flex shrink-0 items-center justify-center', compact ? 'size-8' : 'size-6')}>
        <Download className={compact ? 'size-4' : 'size-3.5'} aria-hidden />
      </span>
      <span className={cn(compact ? 'w-full truncate text-center text-[10px] leading-tight' : 'truncate')}>Exports</span>
    </Link>
  )
}

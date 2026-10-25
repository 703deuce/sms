'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useClipsWorkspace } from '@/components/providers/clips-workspace-provider'
import { groupItems, isItemActive } from '@/lib/nav'
import { useResolvedNavContext } from '@/components/shell/use-resolved-nav-context'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'

type SidebarNavProps = {
  compact?: boolean
  onNavigate?: () => void
  onToggle?: () => void
}

export function SidebarNav({ compact = false, onNavigate, onToggle }: SidebarNavProps) {
  const pathname = usePathname()
  const context = useResolvedNavContext()
  const { testMode } = useClipsWorkspace()
  const groups = groupItems(context.items)
  const ContextIcon = context.icon

  return (
    <nav
      aria-label={`${context.title} navigation`}
      data-shell-context={context.key}
      className="flex h-full flex-col"
    >
      <div className={cn('flex shrink-0 items-center gap-3 px-4 pt-4 pb-3', compact && 'justify-center px-1 pt-3 pb-2')}>
        <span
          title={compact ? context.title : undefined}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg surface text-primary"
        >
          <ContextIcon className="size-4" aria-hidden />
          {compact && <span className="sr-only">{context.title}</span>}
        </span>
        {!compact && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-sidebar-accent-foreground">{context.title}</p>
            <p className="text-xs text-sidebar-muted">Clips workspace</p>
          </div>
        )}
      </div>

      <div className={cn('flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3', compact && 'gap-1 px-1.5 pb-2')}>
        {groups.map((group, index) => (
          <div
            key={group.label || index}
            className={cn('flex flex-col gap-0.5', compact && index > 0 && 'border-t border-sidebar-border pt-1')}
          >
            {!compact && group.label && (
              <p className="px-2.5 pb-0.5 text-[10px] font-semibold tracking-wider text-sidebar-muted uppercase">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const active = isItemActive(item, pathname)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  title={compact ? item.title : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
                    active && 'bg-sidebar-accent text-sidebar-accent-foreground',
                    compact && 'flex-col gap-1 px-1 py-2',
                  )}
                >
                  <span className={cn('flex shrink-0 items-center justify-center', compact ? 'size-8' : 'size-6')}>
                    <Icon className={compact ? 'size-4' : 'size-3.5'} aria-hidden />
                  </span>
                  <span className={cn(compact ? 'w-full truncate text-center text-[10px] leading-tight' : 'truncate')}>
                    {item.title}
                  </span>
                </Link>
              )
            })}
          </div>
        ))}
      </div>

      {!compact && testMode && (
        <div className="mx-3 mb-2 shrink-0 rounded-lg surface px-3 py-2">
          <p className="text-xs font-medium text-sidebar-accent-foreground">Test mode</p>
          <p className="text-[11px] text-sidebar-muted">All features unlocked</p>
          <Progress value={100} className="mt-2 h-1" />
        </div>
      )}

      {onToggle && (
        <div className="shrink-0 border-t border-sidebar-border p-1.5">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!compact}
            aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex w-full items-center rounded-lg text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
              compact ? 'flex-col gap-0.5 px-1 py-1.5' : 'h-8 gap-3 px-2.5 text-sm',
            )}
          >
            {compact ? (
              <PanelLeftOpen className="size-4 shrink-0" aria-hidden />
            ) : (
              <PanelLeftClose className="size-4 shrink-0" aria-hidden />
            )}
            <span className={compact ? 'text-[10px] leading-tight' : undefined}>{compact ? 'Expand' : 'Collapse'}</span>
          </button>
        </div>
      )}
    </nav>
  )
}

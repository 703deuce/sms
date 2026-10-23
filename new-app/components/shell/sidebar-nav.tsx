'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useAgent } from '@/components/providers/agent-provider'
import { groupItems, isItemActive } from '@/lib/nav'
import { usePowerDialerCrmNavEntry, useResolvedNavContext } from '@/components/shell/use-resolved-nav-context'
import { isSharedCrmRoute } from '@/lib/nav-shell-context'
import {
  receptionistModeStatusCopy,
  resolveRuntimeProfile,
} from '@/lib/receptionist/runtime-profile'
import { cn } from '@/lib/utils'

type SidebarNavProps = {
  compact?: boolean
  onNavigate?: () => void
  onToggle?: () => void
}

export function SidebarNav({ compact = false, onNavigate, onToggle }: SidebarNavProps) {
  const pathname = usePathname()
  const { draft, live, changes, unsaved } = useAgent()
  const receptionistProfile = resolveRuntimeProfile(draft)
  const context = useResolvedNavContext(receptionistProfile)
  const markPowerDialerCrm = usePowerDialerCrmNavEntry()
  const receptionistMode =
    context.key === 'receptionist'
      ? receptionistModeStatusCopy({
          draftProfile: receptionistProfile,
          liveProfile: resolveRuntimeProfile(live),
          hasUnpublishedDraft: changes.length > 0 || unsaved,
        })
      : null
  const groups = groupItems(context.items)
  const ContextIcon = context.icon

  return (
    <nav aria-label={`${context.title} navigation`} className="flex h-full flex-col">
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
            <p className="text-xs text-sidebar-muted">
              {context.key === 'workspace'
                ? 'Shared across products'
                : receptionistMode
                  ? receptionistMode.liveLine
                  : 'Subscribed · Active'}
            </p>
            {receptionistMode && receptionistProfile !== resolveRuntimeProfile(live) && (
              <p className="truncate text-[11px] font-medium text-amber-700 dark:text-amber-400">
                {receptionistMode.editingLine}
              </p>
            )}
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
                  onClick={() => {
                    if (context.key === 'power_dialer' && isSharedCrmRoute(item.href)) {
                      markPowerDialerCrm()
                    }
                    onNavigate?.()
                  }}
                  aria-current={active ? 'page' : undefined}
                  title={compact ? item.title : undefined}
                  className={cn(
                    'group relative flex items-center rounded-lg text-sidebar-foreground transition-all focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
                    compact
                      ? 'flex-col justify-center gap-0.5 px-1 py-1'
                      : 'h-8 gap-2.5 px-1.5 text-sm hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground',
                    !compact && active && 'surface font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent',
                    compact && active && 'font-medium text-sidebar-accent-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'flex shrink-0 items-center justify-center rounded-md transition-all',
                      compact ? 'size-7' : 'size-6',
                      active
                        ? 'tile-primary'
                        : 'text-sidebar-muted group-hover:text-sidebar-accent-foreground',
                      compact && !active && 'group-hover:surface',
                    )}
                  >
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

      {!compact && (
        <div className="mx-3 mb-2 flex shrink-0 items-center gap-2 rounded-lg surface px-3 py-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          <p className="truncate text-xs font-medium whitespace-nowrap text-sidebar-accent-foreground" title="(312) 555-0142">
            Main line connected
          </p>
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
            {compact ? <PanelLeftOpen className="size-4 shrink-0" aria-hidden /> : <PanelLeftClose className="size-4 shrink-0" aria-hidden />}
            <span className={compact ? 'text-[10px] leading-tight' : undefined}>{compact ? 'Expand' : 'Collapse'}</span>
          </button>
        </div>
      )}
    </nav>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronsUpDown, PanelLeftClose, PanelLeftOpen, PhoneForwarded } from 'lucide-react'
import { navSections, type NavItem } from '@/lib/nav'
import { cn } from '@/lib/utils'

export function isActive(pathname: string, item: Pick<NavItem, 'href' | 'exact'>) {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(item.href + '/')
}

// Labels are always hidden below md (rail only); on md+ they follow the collapsed toggle.
function labelClass(collapsed: boolean) {
  return collapsed ? 'hidden' : 'hidden md:inline'
}

function LogoMark() {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[oklch(0.66_0.2_285)] to-[oklch(0.5_0.22_265)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
      <PhoneForwarded className="size-4" aria-hidden="true" />
    </span>
  )
}

export function Logo({ className, collapsed = false }: { className?: string; collapsed?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className={cn('text-[15px] font-semibold tracking-tight', labelClass(collapsed))}>Transovo</span>
    </div>
  )
}

function SidebarNav({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Primary" className="flex flex-col gap-5">
      {navSections.map((section, i) => (
        <div key={section.title} className="flex flex-col gap-1">
          <p
            className={cn(
              'px-3 pb-1 text-[11px] font-medium tracking-wide text-sidebar-muted uppercase',
              labelClass(collapsed),
            )}
          >
            {section.title}
          </p>
          {i > 0 && (
            <div
              className={cn('mx-auto mb-1 h-px w-6 bg-sidebar-border', collapsed ? 'block' : 'block md:hidden')}
              aria-hidden="true"
            />
          )}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = isActive(pathname, item)
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={item.label}
                    aria-label={item.label}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex h-9 items-center gap-2.5 rounded-md text-[13px] font-medium transition-colors',
                      collapsed ? 'justify-center px-0' : 'justify-center px-0 md:justify-start md:px-3',
                      active
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                    )}
                  >
                    {active && (
                      <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-sidebar-primary" aria-hidden="true" />
                    )}
                    <Icon
                      className={cn(
                        'size-4 shrink-0',
                        active ? 'text-sidebar-primary' : 'text-sidebar-muted group-hover:text-sidebar-foreground',
                      )}
                      aria-hidden="true"
                    />
                    <span className={cn('flex-1 truncate', labelClass(collapsed))}>{item.label}</span>
                    {item.badge && (
                      <>
                        <span
                          className={cn(
                            'rounded-full bg-sidebar-primary/20 px-1.5 text-[11px] font-semibold text-[oklch(0.82_0.1_277)] tabular-nums',
                            labelClass(collapsed),
                          )}
                        >
                          {item.badge}
                        </span>
                        <span
                          className={cn(
                            'absolute top-1.5 right-2 size-1.5 rounded-full bg-sidebar-primary',
                            collapsed ? 'block' : 'block md:hidden',
                          )}
                          aria-hidden="true"
                        />
                      </>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  return (
    <button
      type="button"
      title="Brightline Plumbing"
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg border border-sidebar-border bg-sidebar-accent/40 py-2 text-left transition-colors hover:bg-sidebar-accent',
        collapsed ? 'justify-center px-0' : 'justify-center px-0 md:justify-start md:px-2.5',
      )}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[oklch(0.72_0.14_190)] text-xs font-bold text-[oklch(0.2_0.03_220)]">
        BP
      </span>
      <span className={cn('min-w-0 flex-1 flex-col', collapsed ? 'hidden' : 'hidden md:flex')}>
        <span className="truncate text-[13px] font-medium text-sidebar-foreground">Brightline Plumbing</span>
        <span className="truncate text-[11px] text-sidebar-muted">Growth plan</span>
      </span>
      <ChevronsUpDown className={cn('size-3.5 text-sidebar-muted', labelClass(collapsed))} aria-hidden="true" />
      <span className="sr-only">Switch workspace</span>
    </button>
  )
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-dvh w-16 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200',
        !collapsed && 'md:w-64',
      )}
    >
      <div className={cn('flex h-14 items-center', collapsed ? 'justify-center px-2' : 'justify-center px-2 md:justify-between md:px-4')}>
        <Logo collapsed={collapsed} />
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className={cn(
            'size-7 items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground',
            collapsed ? 'hidden' : 'hidden md:flex',
          )}
        >
          <PanelLeftClose className="size-4" aria-hidden="true" />
          <span className="sr-only">Collapse sidebar</span>
        </button>
      </div>
      <div className="px-3 pb-3">
        <WorkspaceSwitcher collapsed={collapsed} />
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-6 pt-2">
        <SidebarNav collapsed={collapsed} />
      </div>
      <div className="flex flex-col gap-1 border-t border-sidebar-border p-3">
        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="hidden h-9 items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground md:flex"
          >
            <ToggleIcon className="size-4" aria-hidden="true" />
            <span className="sr-only">Expand sidebar</span>
          </button>
        )}
        <div
          className={cn(
            'flex items-center gap-2.5 rounded-lg py-1.5',
            collapsed ? 'justify-center px-0' : 'justify-center px-0 md:justify-start md:px-2',
          )}
          title="Jamie Reyes"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold">
            JR
          </span>
          <div className={cn('min-w-0 flex-col', collapsed ? 'hidden' : 'hidden md:flex')}>
            <span className="truncate text-[13px] font-medium">Jamie Reyes</span>
            <span className="truncate text-[11px] text-sidebar-muted">jamie@brightline.com</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

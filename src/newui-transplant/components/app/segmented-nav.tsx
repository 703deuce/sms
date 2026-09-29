'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function TabNav({
  items,
  active,
  label,
}: {
  items: { label: string; href: string; count?: number }[]
  active?: string
  label: string
}) {
  const pathname = usePathname()
  const current = active ?? pathname
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto border-b px-4 md:-mx-8 md:px-8">
      <ul className="flex min-w-max gap-5">
        {items.map((item) => {
          const isCurrent = current === item.href
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isCurrent ? 'page' : undefined}
                className={cn(
                  'relative flex h-10 items-center gap-1.5 text-sm font-medium transition-colors',
                  isCurrent ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
                {item.count !== undefined ? (
                  <span className="rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground tabular-nums">{item.count}</span>
                ) : null}
                {isCurrent ? (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" aria-hidden="true" />
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** In-page line tabs (newui2) — use for query-param or local state, not route links. */
export function OpusLineTabs({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: Array<{ value: string; label: string }>
  value: string
  onChange: (value: string) => void
  label: string
}) {
  return (
    <div className="border-b">
      <div role="tablist" aria-label={label} className="flex min-w-0 gap-5 overflow-x-auto">
        {tabs.map((tab) => {
          const selected = value === tab.value
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              id={`opus-tab-${tab.value}`}
              aria-selected={selected}
              aria-controls={`opus-tabpanel-${tab.value}`}
              onClick={() => onChange(tab.value)}
              className={cn(
                'relative shrink-0 pb-3 text-sm font-medium transition-colors',
                selected ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
              {selected ? (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" aria-hidden="true" />
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function Segmented({
  options,
  value,
  onChange,
  label,
  formatLabel,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
  label: string
  formatLabel?: (opt: string) => string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border bg-card p-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          role="radio"
          aria-checked={value === opt}
          onClick={() => onChange(opt)}
          className={cn(
            'h-7 rounded-md px-3 text-xs font-medium transition-colors',
            value === opt ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {formatLabel ? formatLabel(opt) : opt}
        </button>
      ))}
    </div>
  )
}

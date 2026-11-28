'use client'

/**
 * Shared building blocks for the Agent Lab work pages (premium layout pass):
 * KPI tiles with sparklines, small SVG charts, a toolbar, segmented filters, a detail drawer and plain-English errors.
 * Pure presentation: no fetching here, so every page keeps its own data and actions.
 */

import { Search, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { Tone } from '@/lib/agent-lab/ops'
import { cn } from '@/lib/utils'

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-foreground',
  info: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
  muted: 'text-muted-foreground',
}

export const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-foreground/50',
  info: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  muted: 'bg-muted-foreground/50',
}

export const TONE_BAR: Record<Tone, string> = {
  neutral: 'border-l-foreground/40',
  info: 'border-l-primary',
  success: 'border-l-success',
  warning: 'border-l-warning',
  danger: 'border-l-destructive',
  muted: 'border-l-muted-foreground/40',
}

/** Row of KPI tiles: 2 across on phones, up to 4 (or `cols`) on desktop. */
export function KpiGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: 3 | 4 | 5 }) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3 md:gap-4',
        cols === 3 && 'lg:grid-cols-3',
        cols === 4 && 'lg:grid-cols-4',
        cols === 5 && 'lg:grid-cols-5',
      )}
    >
      {children}
    </div>
  )
}

export function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'neutral',
  spark,
  href,
  loading,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon?: LucideIcon
  tone?: Tone
  spark?: number[]
  href?: string
  loading?: boolean
}) {
  const body = (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-card border border-border bg-card p-4 shadow-xs transition-colors hover:border-foreground/15">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {Icon && (
          <span className={cn('grid size-7 place-items-center rounded-lg bg-secondary', TONE_TEXT[tone])}>
            <Icon className="size-3.5" />
          </span>
        )}
      </div>
      <div className={cn('mt-2 text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums', tone !== 'neutral' && TONE_TEXT[tone])}>
        {loading ? <span className="inline-block h-7 w-12 animate-pulse rounded bg-secondary" /> : value}
      </div>
      {sub ? <div className="mt-1.5 truncate text-xs text-muted-foreground">{sub}</div> : null}
      {spark && spark.length > 1 ? (
        <div className="-mx-1 mt-2">
          <Sparkline values={spark} />
        </div>
      ) : null}
    </div>
  )
  return href ? (
    <Link href={href} className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-card">
      {body}
    </Link>
  ) : (
    body
  )
}

export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(1, ...values)
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * 100},${30 - (v / max) * 26}`).join(' ')
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className={cn('h-8 w-full text-primary', className)} aria-hidden>
      <polygon points={`0,32 ${pts} 100,32`} className="fill-primary/15" />
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export type Series = { name: string; values: number[]; className: string }

/** Stacked columns with a legend; labels under each column. Pure SVG so it scales to the card. */
export function StackedColumns({ labels, series, height = 160 }: { labels: string[]; series: Series[]; height?: number }) {
  const totals = labels.map((_, i) => series.reduce((s, x) => s + (x.values[i] ?? 0), 0))
  const max = Math.max(1, ...totals)
  const w = 100 / Math.max(1, labels.length)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn('size-2 rounded-sm', s.className.replace('fill-', 'bg-'))} />
            {s.name}
          </span>
        ))}
      </div>
      <div className="relative" style={{ height }}>
        <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" role="img" aria-label="Chart">
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={0} x2={100} y1={height * f} y2={height * f} className="stroke-border" strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray="2 3" />
          ))}
          {labels.map((l, i) => {
            let y = height
            return (
              <g key={l + i}>
                {series.map((s) => {
                  const h = ((s.values[i] ?? 0) / max) * (height - 4)
                  y -= h
                  return h > 0 ? <rect key={s.name} x={i * w + w * 0.18} width={w * 0.64} y={y} height={h} className={s.className}><title>{`${l}: ${s.name} ${s.values[i]}`}</title></rect> : null
                })}
              </g>
            )
          })}
        </svg>
      </div>
      <div className="flex">
        {labels.map((l, i) => (
          <span key={l + i} className="flex-1 truncate text-center text-[11px] text-muted-foreground tabular-nums">
            {l}
            <span className="block font-medium text-foreground">{totals[i]}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/** Donut for up to ~5 parts, with a legend beside it. */
export function Donut({ parts, centerLabel }: { parts: { label: string; value: number; className: string }[]; centerLabel?: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1
  let acc = 0
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative size-32 shrink-0">
        <svg viewBox="0 0 42 42" className="size-32 -rotate-90" role="img" aria-label="Breakdown">
          <circle cx={21} cy={21} r={15.9} fill="none" className="stroke-secondary" strokeWidth={5} />
          {parts.map((p) => {
            const len = (p.value / total) * 100
            const el = (
              <circle key={p.label} cx={21} cy={21} r={15.9} fill="none" className={p.className} strokeWidth={5} strokeDasharray={`${len} ${100 - len}`} strokeDashoffset={-acc} pathLength={100} />
            )
            acc += len
            return el
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-xl font-semibold tabular-nums">{total}</div>
            {centerLabel && <div className="text-[10px] text-muted-foreground">{centerLabel}</div>}
          </div>
        </div>
      </div>
      <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2 text-xs">
            <span className={cn('size-2 shrink-0 rounded-full', p.className.replace('stroke-', 'bg-'))} />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{p.label}</span>
            <span className="font-medium tabular-nums">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Card with a title row; the standard container for charts, lists and side rails. */
export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn('flex min-w-0 flex-col rounded-card border border-border bg-card shadow-xs', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </header>
      )}
      <div className={cn('min-w-0 p-4', bodyClassName)}>{children}</div>
    </section>
  )
}

/** Filter/search row that wraps on narrow screens. */
export function Toolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative ml-auto flex w-full items-center sm:w-64">
      <Search className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground" aria-hidden />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 w-full rounded-control border border-border bg-background pl-8 pr-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  )
}

/** Segmented control (pill group) for status / type filters. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string; count?: number }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-secondary/40 p-0.5" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            value === o.value ? 'bg-background text-foreground shadow-xs ring-1 ring-border' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
          {typeof o.count === 'number' && <span className="tabular-nums text-muted-foreground">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Dot({ tone, className }: { tone: Tone; className?: string }) {
  return <span className={cn('inline-block size-2 shrink-0 rounded-full', TONE_DOT[tone], className)} aria-hidden />
}

/** Right-side detail drawer; full width on phones. */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b border-border p-5 pr-12">
          <SheetTitle className="text-base">{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer ? <div className="flex flex-wrap gap-2 border-t border-border p-4">{footer}</div> : null}
      </SheetContent>
    </Sheet>
  )
}

export function PropList({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-4 gap-y-2.5 text-sm">
      {items.map((it) => (
        <div key={it.label} className="contents">
          <dt className="text-muted-foreground">{it.label}</dt>
          <dd className="min-w-0 break-words">{it.value}</dd>
        </div>
      ))}
    </dl>
  )
}

const INTERNAL = /(api[ _-]?key|llm|token|credit|cost|usage|billing|context (loop|window)|overflow|stack ?trace|traceback|exception)/i

/**
 * Turn a raw run error or warning into one plain sentence a customer can read.
 * JSON error bodies give their message; internal wording (keys, models, cost, context) becomes a neutral line.
 */
export function plainError(raw: string | null | undefined, fallback = "It ran into a problem it couldn't fix on its own. Open the chat to see what happened."): string {
  if (!raw) return ''
  let text = raw.trim()
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const j = JSON.parse(text) as { error?: { message?: string; status?: string } | string; message?: string }
      const inner = typeof j.error === 'string' ? j.error : j.error?.message || j.message
      text = inner ? String(inner) : fallback
    } catch {
      text = fallback
    }
  }
  if (/permission|forbidden|not have permission|403/i.test(text)) return "The connected account doesn't allow that action, so it finished what it could."
  if (/429|rate limit|too many requests/i.test(text)) return 'The app asked it to slow down, so it finished with what it had.'
  if (INTERNAL.test(text)) return fallback
  text = text.replace(/^agent reported error:\s*/i, '').replace(/\s+/g, ' ')
  if (text.length > 160) text = `${text.slice(0, 157)}…`
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Last N days as local-date keys (YYYY-MM-DD) with short labels, oldest first. */
export function lastDays(n: number, now = new Date()): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setHours(12, 0, 0, 0)
    d.setDate(d.getDate() - i)
    out.push({ key: dayKey(d), label: d.toLocaleDateString(undefined, { weekday: 'short' }) })
  }
  return out
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "Today", "Yesterday" or a short date, for day group headings. */
export function dayHeading(d: Date, now = new Date()): string {
  const k = dayKey(d)
  if (k === dayKey(now)) return 'Today'
  const y = new Date(now)
  y.setDate(y.getDate() - 1)
  if (k === dayKey(y)) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

const MONEY_SENTENCE = /[^.!?\n]*\b(credits?|cost|costs|costing|usage|billing|billed|tokens?|\$\s?\d)[^.!?\n]*[.!?]?/gi
const MONEY_PAREN = /\s*\([^)]*\b(credits?|cost|usage|tokens?|\$\s?\d)[^)]*\)/gi

/** A run's result line with any cost, credit or usage wording removed (customers never see those). */
export function plainSummary(raw: string | null | undefined): string {
  if (!raw) return ''
  let t = raw.replace(MONEY_PAREN, '')
  t = t.replace(MONEY_SENTENCE, ' ')
  t = t.replace(/\s{2,}/g, ' ').replace(/\s+([.,;:])/g, '$1').trim()
  t = t.replace(/^[,;:.\s]+/, '')
  return t
}

export function isOpaqueId(s: string | null | undefined): boolean {
  return !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim())
}

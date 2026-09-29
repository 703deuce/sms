import Link from 'next/link'
import { ArrowRight, ChevronRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Tone } from '@/lib/data'

export function PageHeader({
  title,
  description,
  actions,
  meta,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  meta?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
          {meta}
        </div>
        {description && <p className="max-w-2xl text-sm text-muted-foreground text-pretty">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

const toneStyles: Record<Tone, string> = {
  success: 'bg-success/10 text-[oklch(0.45_0.13_158)] ring-success/25',
  warning: 'bg-warning/15 text-[oklch(0.5_0.13_60)] ring-warning/30',
  danger: 'bg-destructive/10 text-destructive ring-destructive/20',
  info: 'bg-chart-2/12 text-[oklch(0.45_0.1_200)] ring-chart-2/30',
  neutral: 'bg-muted text-muted-foreground ring-border',
  primary: 'bg-primary/10 text-primary ring-primary/20',
}

const dotStyles: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  info: 'bg-chart-2',
  neutral: 'bg-muted-foreground/50',
  primary: 'bg-primary',
}

export function StatusPill({
  tone = 'neutral',
  children,
  dot = true,
  className,
}: {
  tone?: Tone
  children: React.ReactNode
  dot?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        toneStyles[tone],
        className,
      )}
    >
      {dot && <span className={cn('size-1.5 rounded-full', dotStyles[tone])} aria-hidden="true" />}
      {children}
    </span>
  )
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  id?: string
}) {
  return (
    <section
      id={id}
      className={cn('rounded-xl border bg-card shadow-[0_1px_2px_rgba(16,18,40,0.04)]', className)}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {description && <p className="text-sm text-muted-foreground text-pretty">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  )
}

export function StatCard({
  label,
  value,
  sub,
  delta,
  href,
  icon: Icon,
}: {
  label: string
  value: string
  sub?: string
  delta?: { value: string; positive?: boolean }
  href?: string
  icon?: LucideIcon
}) {
  const body = (
    <div className="flex h-full flex-col gap-3 rounded-xl border bg-card p-4 shadow-[0_1px_2px_rgba(16,18,40,0.04)] transition-colors group-hover:border-primary/30">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {Icon && (
          <span className="flex size-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Icon className="size-3.5" aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
        {delta && (
          <span
            className={cn(
              'text-xs font-medium tabular-nums',
              delta.positive ? 'text-[oklch(0.5_0.13_158)]' : 'text-destructive',
            )}
          >
            {delta.value}
          </span>
        )}
      </div>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  )
  if (href)
    return (
      <Link href={href} className="group rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
        {body}
      </Link>
    )
  return body
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline underline-offset-4"
    >
      {children}
      <ArrowRight className="size-3.5" aria-hidden="true" />
    </Link>
  )
}

export function KeyValueRow({
  label,
  value,
  tone,
  href,
}: {
  label: string
  value: React.ReactNode
  tone?: Tone
  href?: string
}) {
  const content = (
    <>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 text-sm font-medium">
        {tone ? <StatusPill tone={tone}>{value}</StatusPill> : value}
        {href && <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />}
      </span>
    </>
  )
  if (href)
    return (
      <Link href={href} className="flex items-center justify-between gap-4 py-3 hover:bg-muted/50 -mx-5 px-5">
        {content}
      </Link>
    )
  return <div className="flex items-center justify-between gap-4 py-3">{content}</div>
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground text-pretty">{description}</p>
      </div>
      {action}
    </div>
  )
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials =
    name
      .replace(/[^A-Za-z ]/g, '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || '#'
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground',
        className,
      )}
      aria-hidden="true"
    >
      {initials}
    </span>
  )
}

export function SettingRow({
  title,
  description,
  control,
}: {
  title: string
  description?: string
  control: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-4 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        {description && <span className="text-sm text-muted-foreground text-pretty">{description}</span>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function Callout({
  tone = 'warning',
  icon: Icon,
  title,
  children,
  action,
}: {
  tone?: Tone
  icon: LucideIcon
  title: string
  children?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-3 rounded-xl px-4 py-3.5 ring-1 ring-inset sm:flex-row sm:items-center', toneStyles[tone])}>
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm font-semibold">{title}</p>
        {children && <div className="text-sm opacity-90">{children}</div>}
      </div>
      {action}
    </div>
  )
}

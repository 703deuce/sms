import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight, ChevronRight, type LucideIcon } from 'lucide-react'
import { OPUS_CARD, OPUS_CONFIG_INSET, OPUS_STATUS_ANCHOR } from '@/newui-transplant/components/app/opus-surfaces'
import { cn } from '@/lib/utils'

export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <main className={cn('mx-auto w-full max-w-7xl px-4 py-5 md:px-8 md:py-6', className)}>{children}</main>
}

export function PageHeader({
  title,
  description,
  actions,
  status,
  meta,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  status?: React.ReactNode
  meta?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
          {status}
          {meta}
        </div>
        {description ? <p className="max-w-2xl text-pretty text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
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
    <section id={id} className={cn(OPUS_CARD, className)}>
      {title || action ? (
        <header className="flex items-start justify-between gap-4 border-b bg-card px-5 py-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            {title ? <h2 className="text-sm font-semibold">{title}</h2> : null}
            {description ? <p className="text-pretty text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      <div className={cn('bg-card p-5', bodyClassName)}>{children}</div>
    </section>
  )
}

export function Stat({
  label,
  value,
  delta,
  hint,
  href,
  icon: Icon,
}: {
  label: string
  value: string
  delta?: number
  hint?: string
  href?: string
  icon?: LucideIcon
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        {Icon ? (
          <span className="flex size-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Icon className="size-3.5" aria-hidden="true" />
          </span>
        ) : href ? (
          <ChevronRight className="size-3.5 opacity-0 transition group-hover:opacity-100" aria-hidden="true" />
        ) : null}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">{value}</span>
        {delta !== undefined ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
              delta >= 0 ? 'text-success' : 'text-destructive',
            )}
          >
            {delta >= 0 ? <ArrowUpRight className="size-3" aria-hidden="true" /> : <ArrowDownRight className="size-3" aria-hidden="true" />}
            {Math.abs(delta)}%
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </>
  )
  const cls = cn('group block p-4 transition-colors hover:border-primary/30', OPUS_CARD)
  return href ? (
    <Link href={href} className={cn(cls, 'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary'

const toneClass: Record<Tone, string> = {
  success: 'bg-success/10 text-[oklch(0.45_0.13_158)] ring-success/25',
  warning: 'bg-warning/15 text-[oklch(0.5_0.13_60)] ring-warning/30',
  danger: 'bg-destructive/10 text-destructive ring-destructive/20',
  info: 'bg-chart-2/12 text-[oklch(0.45_0.1_200)] ring-chart-2/30',
  neutral: 'bg-muted text-muted-foreground ring-border',
  primary: 'bg-primary/10 text-primary ring-primary/20',
}

const dotClass: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  info: 'bg-chart-2',
  neutral: 'bg-muted-foreground/50',
  primary: 'bg-primary',
}

export function Pill({
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
        'inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium ring-1 ring-inset',
        toneClass[tone],
        className,
      )}
    >
      {dot ? <span className={cn('size-1.5 rounded-full', dotClass[tone])} aria-hidden="true" /> : null}
      {children}
    </span>
  )
}

export function Rows({
  items,
}: {
  items: { label: string; value: React.ReactNode; href?: string }[]
}) {
  return (
    <dl className="divide-y">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
          <dt className="text-sm text-muted-foreground">{item.label}</dt>
          <dd className="flex min-w-0 items-center gap-2 text-right text-sm">
            {item.value}
            {item.href ? (
              <Link href={item.href} className="text-muted-foreground hover:text-foreground" aria-label={`Edit ${item.label}`}>
                <ChevronRight className="size-4" aria-hidden="true" />
              </Link>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
    >
      {children}
      <ChevronRight className="size-3.5" aria-hidden="true" />
    </Link>
  )
}

/** Dark emphasis strip (New UI 2) — high-attention operational module on light canvas. */
export function FeatureEmphasisStrip({
  icon: Icon,
  title,
  badge,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  badge?: React.ReactNode
  description: string
  action?: React.ReactNode
}) {
  return (
    <section className="relative overflow-hidden rounded-xl border bg-sidebar p-5 text-sidebar-foreground">
      <div
        className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full bg-primary opacity-20 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary/25 text-sidebar-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{title}</p>
            {badge}
          </div>
          <p className="text-sm text-sidebar-foreground/75 text-pretty">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </section>
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
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl px-4 py-3.5 ring-1 ring-inset sm:flex-row sm:items-center',
        toneClass[tone],
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm font-semibold">{title}</p>
        {children ? <div className="text-sm opacity-90">{children}</div> : null}
      </div>
      {action}
    </div>
  )
}

export function SetupProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex flex-col gap-1.5">
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={`Setup progress ${pct}%`}
        />
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        {value} of {max} essentials complete
      </p>
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>
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
        <p className="max-w-sm text-pretty text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  )
}

/** Grouped configuration block — hierarchy without stacking full cards. */
export function OpusIconBadge({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary',
        className,
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
    </span>
  )
}

export function ConfigSection({
  title,
  description,
  icon: Icon,
  children,
  className,
  insetClassName,
}: {
  title: string
  description?: string
  icon?: LucideIcon
  children: React.ReactNode
  className?: string
  insetClassName?: string
}) {
  return (
    <section className={cn('flex flex-col gap-2.5', className)}>
      <div className="flex items-start gap-3">
        {Icon ? <OpusIconBadge icon={Icon} className="mt-0.5" /> : null}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-pretty text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      <div className={cn(OPUS_CONFIG_INSET, 'p-4 sm:p-5', insetClassName)}>{children}</div>
    </section>
  )
}

export function OpusStatusAnchor({
  label,
  status,
  tone = 'neutral',
  children,
}: {
  label: string
  status: string
  tone?: Tone
  children?: React.ReactNode
}) {
  const dot =
    tone === 'success'
      ? 'bg-success'
      : tone === 'warning'
        ? 'bg-warning'
        : tone === 'danger'
          ? 'bg-destructive'
          : 'bg-muted-foreground'
  return (
    <div className={OPUS_STATUS_ANCHOR}>
      <span className="font-medium text-foreground">{label}</span>
      <span className="inline-flex items-center gap-1.5 font-medium">
        <span className={cn('size-2 rounded-full', dot)} aria-hidden="true" />
        {status}
      </span>
      {children}
    </div>
  )
}

/** New UI 2 settings row — prefer over FieldRow for toggle lists. */
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
        {description ? <span className="text-pretty text-sm text-muted-foreground">{description}</span> : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

export function FieldRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return <SettingRow title={label} description={description} control={children} />
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
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
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
        {tone ? <Pill tone={tone}>{value}</Pill> : value}
        {href ? <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" /> : null}
      </span>
    </>
  )
  if (href) {
    return (
      <Link href={href} className="-mx-5 flex items-center justify-between gap-4 px-5 py-3 hover:bg-muted/50">
        {content}
      </Link>
    )
  }
  return <div className="flex items-center justify-between gap-4 py-3">{content}</div>
}

export function Initials({ name, className }: { name: string; className?: string }) {
  const initials = name.startsWith('(')
    ? '#'
    : name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
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

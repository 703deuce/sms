import Link from 'next/link'
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CalendarCheck,
  CheckCheck,
  ChevronRight,
  Clock,
  Inbox,
  MessageCircleReply,
  MessageSquareText,
  Percent,
  PhoneCall,
  PhoneForwarded,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Plug,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Timer,
  Voicemail,
  type LucideIcon,
} from 'lucide-react'
import { TONE_TILE, type ToneTileKey } from '@/lib/ui/tones'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

export function PageContainer({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-6 py-6', className)} data-testid="page-container">
      {children}
    </div>
  )
}

export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-grid-fade" />
      <PageContainer className={cn('relative', className)}>{children}</PageContainer>
    </div>
  )
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  breadcrumbs,
  icon: Icon,
  iconTone = 'brand',
  meta,
}: {
  title: string
  description?: React.ReactNode
  eyebrow?: React.ReactNode
  actions?: React.ReactNode
  breadcrumbs?: { label: string; href?: string }[]
  icon?: LucideIcon
  iconTone?: ToneTileKey
  meta?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      {breadcrumbs && (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {breadcrumbs.map((b, i) => (
              <li key={b.label} className="flex items-center gap-1">
                {b.href ? (
                  <Link href={b.href} className="transition-colors hover:text-foreground">
                    {b.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="font-medium text-foreground">
                    {b.label}
                  </span>
                )}
                {i < breadcrumbs.length - 1 && <ChevronRight className="size-3 opacity-60" aria-hidden />}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <header className="flex flex-wrap items-end justify-between gap-4 pb-2">
        <div className="flex min-w-0 items-start gap-3.5">
          {Icon && (
            <div
              className={cn(
                'grid size-11 shrink-0 place-items-center rounded-xl shadow-sm ring-1 ring-inset ring-white/10',
                TONE_TILE[iconTone],
              )}
            >
              <Icon className="size-5" />
            </div>
          )}
          <div className="min-w-0 flex flex-col gap-2">
            {eyebrow && <div className="flex flex-wrap items-center gap-2">{eyebrow}</div>}
            <h1 className="truncate text-page-title tracking-tight">{title}</h1>
            {description && <p className="max-w-prose text-sm text-muted-foreground">{description}</p>}
            {meta && <div className="flex flex-wrap items-center gap-2">{meta}</div>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
    </div>
  )
}

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-section-title font-semibold">{title}</h2>
      {action}
    </div>
  )
}

export function CardGrid({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4', className)}>{children}</div>
  )
}

export function IconTile({
  icon: Icon,
  tone = 'default',
  size = 'md',
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-lg ring-1 ring-inset',
        size === 'sm' ? 'size-7' : 'size-9',
        tone === 'default' && 'bg-linear-to-b from-card to-muted text-foreground/70 ring-foreground/8 shadow-xs',
        tone === 'primary' && 'tile-primary ring-transparent',
        tone === 'success' && 'bg-success/10 text-success ring-success/20',
        tone === 'warning' && 'bg-warning/15 text-warning-foreground ring-warning/30',
        tone === 'danger' && 'bg-destructive/8 text-destructive ring-destructive/20',
        className,
      )}
    >
      <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} />
    </span>
  )
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  icon,
}: {
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <section className={cn('rounded-card border border-border bg-card p-4', !title && !actions && 'flex flex-col', className)}>
      {(title || actions) && (
        <header className="mb-4 flex items-start justify-between gap-4 border-b border-border/70 pb-3">
          <div className="flex min-w-0 items-start gap-3">
            {icon && <IconTile icon={icon} size="sm" />}
            <div className="flex min-w-0 flex-col gap-0.5">
              {title && <h2 className="text-sm font-semibold">{title}</h2>}
              {description && <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(!title && !actions ? undefined : 'flex-1', bodyClassName)}>{children}</div>
    </section>
  )
}

const STAT_ICONS: { match: RegExp; icon: LucideIcon }[] = [
  { match: /^inbound/i, icon: PhoneIncoming },
  { match: /^outbound/i, icon: PhoneOutgoing },
  { match: /^missed/i, icon: PhoneMissed },
  { match: /voicemail/i, icon: Voicemail },
  { match: /talk time/i, icon: Clock },
  { match: /handle time/i, icon: Timer },
  { match: /answer rate/i, icon: Percent },
  { match: /calls handled/i, icon: Bot },
  { match: /booked/i, icon: CalendarCheck },
  { match: /transferred/i, icon: PhoneForwarded },
  { match: /attention/i, icon: AlertTriangle },
  { match: /consent/i, icon: ShieldCheck },
  { match: /delivered/i, icon: CheckCheck },
  { match: /reply rate/i, icon: MessageSquareText },
  { match: /replied|replies/i, icon: MessageCircleReply },
  { match: /recovered/i, icon: RefreshCcw },
  { match: /callback/i, icon: PhoneCall },
  { match: /unread|message/i, icon: Inbox },
  { match: /integration/i, icon: Plug },
  { match: /clip/i, icon: Sparkles },
  { match: /credit/i, icon: Percent },
  { match: /minute/i, icon: Clock },
  { match: /export/i, icon: CheckCheck },
]

function iconForLabel(label: string): LucideIcon {
  return STAT_ICONS.find((s) => s.match.test(label))?.icon ?? Sparkles
}

export function Stat({
  label,
  value,
  hint,
  tone = 'default',
  href,
  icon,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  tone?: 'default' | 'warning' | 'danger' | 'success'
  href?: string
  icon?: LucideIcon
}) {
  const Icon = icon ?? iconForLabel(label)
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <IconTile icon={Icon} size="sm" tone={tone} />
      </div>
      <p
        className={cn(
          'text-[26px] leading-none font-semibold tracking-tight tabular',
          tone === 'warning' && 'text-warning-foreground',
          tone === 'danger' && 'text-destructive',
          tone === 'success' && 'text-success',
        )}
      >
        {value}
      </p>
      {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      {href && (
        <ArrowUpRight
          aria-hidden
          className="absolute right-3 bottom-3 size-3.5 text-muted-foreground opacity-0 transition-all group-hover:-translate-y-0.5 group-hover:opacity-100"
        />
      )}
    </>
  )
  const cls = 'group relative flex flex-col gap-2.5 rounded-xl surface p-4'
  if (href)
    return (
      <Link
        href={href}
        className={cn(cls, 'transition-all hover:-translate-y-px hover:surface-raised focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none')}
      >
        {content}
      </Link>
    )
  return <div className={cls}>{content}</div>
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
    <div className="flex flex-col items-center py-12 text-center">
      <div className="grid size-10 place-items-center rounded-lg bg-secondary">
        <Icon className="size-5 text-foreground" />
      </div>
      <h3 className="mt-4 text-sm font-medium">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-5 flex justify-center gap-2">{action}</div> : null}
    </div>
  )
}

export function PageSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <CardGrid>
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="aspect-video rounded-card" />
        ))}
      </CardGrid>
    </div>
  )
}

export function KeyValue({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.label} className="flex flex-col gap-1">
          <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{i.label}</dt>
          <dd className="text-sm">{i.value}</dd>
        </div>
      ))}
    </dl>
  )
}

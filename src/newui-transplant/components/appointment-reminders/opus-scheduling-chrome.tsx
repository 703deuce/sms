'use client'

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OPUS_CARD, OPUS_TABLE_HEAD } from '@/newui-transplant/components/app/opus-surfaces'
import { OpusIconBadge, type Tone } from '@/newui-transplant/components/app/kit'
import { th, td } from '@/newui-transplant/components/app/opus-tables'

/** Table cell classes aligned with MCTB / AR Opus tables. */
export const OpusTh = th
export const OpusTd = td
export { OPUS_TABLE_HEAD }

const GRADIENT_SURFACE =
  'bg-gradient-to-br from-card via-card to-primary/[0.05] shadow-[0_1px_2px_rgba(16,18,40,0.04)]'

export function OpusSchedulingHero({
  icon,
  title,
  description,
  actions,
  meta,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  meta?: React.ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        OPUS_CARD,
        GRADIENT_SURFACE,
        'mb-6 overflow-hidden p-5 md:p-6',
        className,
      )}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <OpusIconBadge icon={icon} className="size-11 rounded-xl bg-primary/12" />
          <div className="min-w-0 flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
              {meta}
            </div>
            {description ? (
              <div className="max-w-2xl text-pretty text-sm text-muted-foreground">{description}</div>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}

export function OpusMetricBand({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn(OPUS_CARD, GRADIENT_SURFACE, 'mb-6 p-4 md:p-5', className)}>{children}</section>
  )
}

export function OpusListControls({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        OPUS_CARD,
        'mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function OpusPremiumDialogHeader({
  icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description?: React.ReactNode
}) {
  return (
    <div className="flex gap-3 border-b bg-gradient-to-b from-card to-muted/25 px-6 py-5 pr-12">
      <OpusIconBadge icon={icon} className="size-10 rounded-xl" />
      <div className="min-w-0 flex flex-col gap-0.5 text-left">
        <h2 className="text-lg font-semibold leading-tight">{title}</h2>
        {description ? (
          <div className="text-sm text-muted-foreground">{description}</div>
        ) : null}
      </div>
    </div>
  )
}

export function appointmentStatusTone(status: string): Tone {
  const s = status.toLowerCase()
  if (s.includes('cancel')) return 'danger'
  if (s.includes('confirm') || s.includes('complete')) return 'success'
  if (s.includes('attention') || s.includes('no_show') || s.includes('no-show')) return 'warning'
  if (s.includes('pending') || s.includes('scheduled') || s.includes('booked')) return 'info'
  return 'neutral'
}

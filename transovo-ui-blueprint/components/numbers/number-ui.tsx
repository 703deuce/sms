'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, MessageSquare, Phone, Image as ImageIcon, X, ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PRODUCT_LABEL, type NumberProduct } from '@/lib/numbers'
import { cn } from '@/lib/utils'

export function CapabilityChips({ caps, className }: { caps: { voice: boolean; sms: boolean; mms: boolean }; className?: string }) {
  const items = [
    { key: 'voice', label: 'Voice', icon: Phone, on: caps.voice },
    { key: 'sms', label: 'SMS', icon: MessageSquare, on: caps.sms },
    { key: 'mms', label: 'MMS', icon: ImageIcon, on: caps.mms },
  ]
  return (
    <ul className={cn('flex flex-wrap items-center gap-1', className)} aria-label="Capabilities">
      {items.map(({ key, label, icon: Icon, on }) => (
        <li
          key={key}
          className={cn(
            'inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium ring-1 ring-inset',
            on ? 'bg-card text-foreground/80 ring-foreground/10' : 'bg-muted/60 text-muted-foreground/60 line-through ring-transparent',
          )}
        >
          <Icon className="size-3" aria-hidden />
          {label}
          <span className="sr-only">{on ? 'supported' : 'not supported'}</span>
        </li>
      ))}
    </ul>
  )
}

const productDot: Record<NumberProduct, string> = {
  phone: 'bg-primary',
  receptionist: 'bg-chart-2',
  mctb: 'bg-chart-3',
  sms: 'bg-chart-4',
}

export function ProductChips({ products, empty = 'Unassigned' }: { products: NumberProduct[]; empty?: string }) {
  const unique = [...new Set(products)]
  if (!unique.length) return <span className="text-xs text-muted-foreground italic">{empty}</span>
  return (
    <ul className="flex flex-wrap gap-1">
      {unique.map((p) => (
        <li key={p} className="inline-flex h-5 items-center gap-1.5 rounded-full bg-secondary px-2 text-[11px] font-medium text-secondary-foreground">
          <span aria-hidden className={cn('size-1.5 rounded-full', productDot[p])} />
          {PRODUCT_LABEL[p]}
        </li>
      ))}
    </ul>
  )
}

export function StepRail({ steps, current, onJump }: { steps: string[]; current: number; onJump?: (i: number) => void }) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto" aria-label="Progress">
      {steps.map((s, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={s} className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              disabled={!done || !onJump}
              onClick={() => onJump?.(i)}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-xs font-medium transition-colors',
                active && 'bg-accent text-accent-foreground',
                done && 'text-foreground hover:bg-muted',
                !done && !active && 'text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'flex size-5 items-center justify-center rounded-full text-[10px] font-semibold',
                  active && 'tile-primary',
                  done && 'bg-success/15 text-success',
                  !done && !active && 'bg-muted text-muted-foreground',
                )}
              >
                {done ? <Check className="size-3" aria-hidden /> : i + 1}
              </span>
              {s}
            </button>
            {i < steps.length - 1 && <span aria-hidden className={cn('h-px w-4', done ? 'bg-success/40' : 'bg-border')} />}
          </li>
        )
      })}
    </ol>
  )
}

/** Full-height stepper with a pinned footer; asks before discarding unsaved progress. */
export function WizardShell({
  title,
  subtitle,
  steps,
  current,
  onJump,
  dirty,
  closeHref,
  children,
  onBack,
  onNext,
  nextLabel = 'Continue',
  nextDisabled,
  nextLoading,
  footerNote,
  hideFooter,
}: {
  title: string
  subtitle?: string
  steps: string[]
  current: number
  onJump?: (i: number) => void
  dirty: boolean
  closeHref: string
  children: React.ReactNode
  onBack?: () => void
  onNext?: () => void
  nextLabel?: string
  nextDisabled?: boolean
  nextLoading?: boolean
  footerNote?: React.ReactNode
  hideFooter?: boolean
}) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const close = () => (dirty ? setConfirm(true) : router.push(closeHref))

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col">
      <div className="sticky top-16 z-20 border-b bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 md:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate font-heading text-lg font-semibold tracking-tight">{title}</h1>
              {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
            </div>
            <Button variant="ghost" size="icon-sm" onClick={close} aria-label="Close">
              <X />
            </Button>
          </div>
          <StepRail steps={steps} current={current} onJump={onJump} />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 md:px-8">{children}</div>

      {!hideFooter && (
        <div className="sticky bottom-0 z-20 border-t bg-background/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 md:px-8">
            <div className="text-xs text-muted-foreground">{footerNote}</div>
            <div className="flex items-center gap-2">
              {onBack && (
                <Button variant="outline" onClick={onBack}>
                  <ArrowLeft data-icon="inline-start" />
                  Back
                </Button>
              )}
              {onNext && (
                <Button onClick={onNext} disabled={nextDisabled || nextLoading}>
                  {nextLoading ? 'Working…' : nextLabel}
                  {!nextLoading && <ArrowRight data-icon="inline-end" />}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard this setup?</DialogTitle>
            <DialogDescription>Your progress in this flow will be lost. Nothing has been purchased or changed yet.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Keep editing
            </Button>
            <Button variant="destructive" onClick={() => router.push(closeHref)}>
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function ChoiceCard({
  selected,
  onSelect,
  icon: Icon,
  title,
  description,
  badge,
  disabled,
}: {
  selected: boolean
  onSelect: () => void
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: React.ReactNode
  badge?: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'group relative flex w-full items-start gap-3 rounded-xl p-4 text-left ring-1 transition-all disabled:cursor-not-allowed disabled:opacity-50',
        selected ? 'bg-accent/60 shadow-sm ring-2 ring-primary' : 'surface-raised ring-foreground/8 hover:ring-foreground/20',
      )}
    >
      {Icon && (
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset',
            selected ? 'tile-primary ring-transparent' : 'bg-linear-to-b from-card to-muted text-foreground/70 ring-foreground/8',
          )}
        >
          <Icon className="size-4" />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2 text-sm font-medium">
          {title}
          {badge}
        </span>
        {description && <span className="text-xs leading-relaxed text-muted-foreground">{description}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ring-1',
          selected ? 'bg-primary text-primary-foreground ring-primary' : 'ring-foreground/20',
        )}
      >
        {selected && <Check className="size-2.5" />}
      </span>
    </button>
  )
}

export function FlowDiagram({ steps }: { steps: string[] }) {
  return (
    <ol className="flex flex-col gap-0" aria-label="Call flow">
      {steps.map((s, i) => (
        <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
          {i < steps.length - 1 && <span aria-hidden className="absolute top-5 left-2.5 h-[calc(100%-1rem)] w-px bg-border" />}
          <span
            className={cn(
              'relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
              i === 0 ? 'tile-primary' : 'bg-card text-muted-foreground ring-1 ring-border',
            )}
          >
            {i + 1}
          </span>
          <span className="text-sm leading-5">{s}</span>
        </li>
      ))}
    </ol>
  )
}

export function StepIntro({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="font-heading text-xl font-semibold tracking-tight text-balance">{title}</h2>
      <p className="text-sm leading-relaxed text-pretty text-muted-foreground">{text}</p>
    </div>
  )
}

export function Field({ id, label, children, hint }: { id: string; label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function Callout({ tone = 'info', title, children, icon: Icon }: { tone?: 'info' | 'warning' | 'danger' | 'success'; title?: string; children: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : undefined}
      className={cn(
        'flex gap-3 rounded-xl p-4 text-sm ring-1 ring-inset',
        tone === 'info' && 'bg-accent/50 text-accent-foreground ring-primary/15',
        tone === 'warning' && 'bg-warning/10 text-warning-foreground ring-warning/30',
        tone === 'danger' && 'bg-destructive/6 text-destructive ring-destructive/20',
        tone === 'success' && 'bg-success/8 text-success ring-success/20',
      )}
    >
      {Icon && <Icon className="mt-0.5 size-4 shrink-0" />}
      <div className="flex min-w-0 flex-col gap-1">
        {title && <p className="font-medium">{title}</p>}
        <div className="leading-relaxed text-pretty opacity-90">{children}</div>
      </div>
    </div>
  )
}

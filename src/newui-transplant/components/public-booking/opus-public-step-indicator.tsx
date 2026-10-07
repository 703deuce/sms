'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export type OpusPublicStep = 'service' | 'datetime' | 'info' | 'done' | 'ai' | 'waitlist' | 'payment'

const STEP_LABELS: Array<{ key: 'service' | 'datetime' | 'info'; label: string }> = [
  { key: 'service', label: 'Service' },
  { key: 'datetime', label: 'Date & time' },
  { key: 'info', label: 'Your details' },
]

export function OpusPublicStepIndicator({ step }: { step: OpusPublicStep }) {
  if (step === 'ai' || step === 'waitlist') return null
  const activeIndex =
    step === 'done' ? STEP_LABELS.length : STEP_LABELS.findIndex((s) => s.key === step)
  return (
    <ol className="mb-6 flex items-center justify-center gap-1.5" aria-label="Booking progress">
      {STEP_LABELS.map((s, i) => {
        const complete = i < activeIndex
        const active = i === activeIndex
        return (
          <li key={s.key} className="flex items-center gap-1.5">
            <span
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                complete
                  ? 'bg-primary text-primary-foreground'
                  : active
                    ? 'bg-primary text-primary-foreground ring-4 ring-primary/15'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {complete ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                'hidden text-xs font-medium sm:inline',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {s.label}
            </span>
            {i < STEP_LABELS.length - 1 ? <span className="mx-1 h-px w-8 bg-border" aria-hidden /> : null}
          </li>
        )
      })}
    </ol>
  )
}

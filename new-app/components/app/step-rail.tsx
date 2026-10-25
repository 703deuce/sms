'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

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

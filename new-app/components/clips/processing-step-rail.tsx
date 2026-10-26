'use client'

import type { LucideIcon } from 'lucide-react'
import {
  Check,
  CheckCircle2,
  Crop,
  FileText,
  ScanLine,
  Sparkles,
  UploadCloud,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const STEP_ICONS: LucideIcon[] = [UploadCloud, FileText, ScanLine, Sparkles, Crop, CheckCircle2]

export function ProcessingStepRail({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol
      className="flex flex-col gap-3 md:flex-row md:items-center md:gap-0"
      aria-label="Processing progress"
    >
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        const pending = i > current
        const Icon = STEP_ICONS[i] ?? CheckCircle2
        return (
          <li key={label} className="flex items-center md:flex-1">
            <div className="flex flex-col items-center gap-1.5 md:flex-row md:gap-2">
              <span className="relative grid size-9 place-items-center rounded-full ring-1 ring-inset">
                {active && (
                  <span
                    className="absolute inset-0 animate-ping rounded-full bg-primary/30"
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    'relative grid size-9 place-items-center rounded-full ring-1 ring-inset',
                    done && 'bg-success/15 text-success ring-success/30',
                    active && 'bg-brand-gradient text-white ring-white/20 shadow-glow',
                    pending && 'bg-muted text-muted-foreground ring-border',
                  )}
                >
                  {done ? <Check className="size-4" aria-hidden /> : <Icon className="size-4" aria-hidden />}
                </span>
              </span>
              <span
                className={cn(
                  'text-xs font-medium text-center md:text-left',
                  active ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  'mx-2 hidden h-0.5 flex-1 rounded-full md:block',
                  done ? 'bg-success/50' : 'bg-border',
                )}
                aria-hidden
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

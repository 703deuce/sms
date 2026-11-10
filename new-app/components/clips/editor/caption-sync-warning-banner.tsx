"use client"

import type { ChangeEvent } from 'react'
import { cn } from '../../../lib/utils'
import type { CaptionSyncWarning } from '../../../lib/clips/editor/caption-sync-warning'

export function CaptionSyncWarningBanner({
  warnings,
  acknowledge,
  onAcknowledgeChange,
  showAcknowledge = false,
  className,
  testId = 'caption-sync-warning',
  ackTestId = 'caption-sync-export-ack',
}: {
  warnings: CaptionSyncWarning[]
  acknowledge?: boolean
  onAcknowledgeChange?: (next: boolean) => void
  showAcknowledge?: boolean
  className?: string
  testId?: string
  ackTestId?: string
}) {
  if (!warnings.length) return null
  const primary = warnings[0]!
  return (
    <div
      role="status"
      data-testid={testId}
      className={cn(
        'rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm',
        className,
      )}
    >
      <p className="font-medium text-foreground">Captions may be out of sync</p>
      <p className="mt-1 text-xs text-muted-foreground">{primary.message}</p>
      {warnings.length > 1 ? (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
          {warnings.slice(1).map((w: CaptionSyncWarning) => (
            <li key={w.code}>{w.message}</li>
          ))}
        </ul>
      ) : null}
      {showAcknowledge ? (
        <label className="mt-3 flex items-start gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            className="mt-0.5 size-4 rounded border-border accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid={ackTestId}
            checked={!!acknowledge}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onAcknowledgeChange?.(e.target.checked)}
          />
          <span>Export anyway. Burned-in captions and SRT will use the current timings.</span>
        </label>
      ) : null}
    </div>
  )
}

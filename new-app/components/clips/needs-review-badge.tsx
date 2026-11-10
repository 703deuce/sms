'use client'

import { clipNeedsReview, clipNeedsReviewReasons } from '../../lib/clips/clip-needs-review'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'

const BADGE_LABEL = 'Needs review'

function reasonsLabel(reasons: string[]): string {
  if (!reasons.length) return BADGE_LABEL
  return `${BADGE_LABEL}: ${reasons.join('; ')}`
}

export function NeedsReviewBadge({ aiMeta }: { aiMeta?: unknown }) {
  if (!clipNeedsReview(aiMeta)) return null
  const reasons = clipNeedsReviewReasons(aiMeta)
  const label = reasonsLabel(reasons)

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              data-testid="clip-needs-review-badge"
              aria-label={label}
              className="inline-flex items-center rounded-md border border-warning/40 bg-warning/15 px-1.5 py-0.5 text-xs font-medium text-warning-foreground ring-1 ring-inset ring-warning/30 hover:bg-warning/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning"
            />
          }
        >
          {BADGE_LABEL}
        </TooltipTrigger>
        <TooltipContent data-testid="clip-needs-review-reasons" className="max-w-xs">
          {reasons.length ? (
            <ul className="flex list-disc flex-col gap-1 pl-4 text-xs">
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs">This clip published with leftover editorial notes.</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function NeedsReviewReasonList({
  aiMeta,
  className,
}: {
  aiMeta?: unknown
  className?: string
}) {
  const reasons = clipNeedsReviewReasons(aiMeta)
  if (!clipNeedsReview(aiMeta) || !reasons.length) return null
  return (
    <ul
      data-testid="clip-needs-review-reason-list"
      className={className ?? 'flex list-disc flex-col gap-1 pl-4 text-xs text-muted-foreground'}
    >
      {reasons.map((reason) => (
        <li key={reason}>{reason}</li>
      ))}
    </ul>
  )
}

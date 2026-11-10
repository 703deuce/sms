import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export function UnifiedClipRunNote({
  children,
  testId = 'unified-clip-run-note',
  className,
}: {
  children?: ReactNode
  testId?: string
  className?: string
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        'mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/60 px-3 py-2.5',
        className,
      )}
    >
      <p className="text-xs text-muted-foreground">
        Each run finds <span className="font-medium text-foreground">Story</span> and{' '}
        <span className="font-medium text-foreground">Continuous</span> clips in one pass.
      </p>
      {children}
    </div>
  )
}

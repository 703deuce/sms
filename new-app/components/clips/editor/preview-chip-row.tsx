'use client'

import type { ReactNode } from 'react'

const chipBtnClass =
  'inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-secondary px-2.5 text-[12px] font-medium text-secondary-foreground hover:bg-accent [&_svg]:size-4'

export function previewChipButtonClass(extra?: string) {
  return extra ? `${chipBtnClass} ${extra}` : chipBtnClass
}

/** Preview toolbar chips (below the player, not over the video). */
export function PreviewChipRow({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none]"
      data-testid="preview-chip-row"
      data-canvas-skip
    >
      {children}
    </div>
  )
}

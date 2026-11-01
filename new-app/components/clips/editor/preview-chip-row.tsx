'use client'

import type { ReactNode } from 'react'

const chipBtnClass =
  'pointer-events-auto shrink-0 whitespace-nowrap rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-medium text-white ring-1 ring-white/15'

export function previewChipButtonClass(extra?: string) {
  return extra ? `${chipBtnClass} ${extra}` : chipBtnClass
}

/** CV09fix: preview frame controls above the canvas selection overlay (z-40). */
export function PreviewChipRow({ children }: { children: ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute inset-x-2 bottom-2 z-[45] flex flex-nowrap items-end justify-end gap-1"
      data-testid="preview-chip-row"
      data-canvas-skip
    >
      {children}
    </div>
  )
}

'use client'

import type { CSSProperties } from 'react'
import { captionFontStack } from '@/lib/clips/caption-fonts'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { textDisplay } from '@/lib/clips/editor/text-items'
import { textItemCss } from '@/lib/clips/editor/text-frame'

/**
 * E4 Text-lane items over the preview (export: worker text_items.py ASS, burned with the hook).
 * Each item is a frame-sized layer (so keyframe translate % = % of the frame, like the export) whose
 * visibility / transform / opacity the preview tick drives (textItemFrame).
 */
export function TextItemsPreview({
  edits,
  boxH,
  elRef,
  selectedId,
}: {
  edits: ClipEditsV2
  boxH: number
  elRef: (id: string, el: HTMLDivElement | null) => void
  selectedId?: string | null
}) {
  const items = edits.textItems ?? []
  if (!items.length || boxH <= 0) return null
  return (
    <>
      {items.map((it) => {
        const css = textItemCss(it, boxH)
        const fontFamily = captionFontStack(it.style.font === 'Montserrat' ? 'Montserrat Black' : it.style.font)
        return (
          <div
            key={it.id}
            ref={(el) => elRef(it.id, el)}
            className="pointer-events-none absolute inset-0 z-[23]"
            style={{ transformOrigin: css.origin, visibility: 'hidden', opacity: 0 }}
            data-testid="preview-text-item"
            data-text-id={it.id}
            aria-hidden
          >
            <div className="absolute" style={css.anchor as CSSProperties}>
              <span
                style={{ ...(css.text as CSSProperties), fontFamily, ...(css.box as CSSProperties | null) }}
                className={selectedId === it.id ? 'outline outline-1 outline-dashed outline-white/70' : undefined}
              >
                {textDisplay(it)}
              </span>
            </div>
          </div>
        )
      })}
    </>
  )
}

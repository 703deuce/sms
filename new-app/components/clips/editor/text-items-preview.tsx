'use client'

import type { CSSProperties } from 'react'
import { captionFontStack } from '@/lib/clips/caption-fonts'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { textDisplay } from '@/lib/clips/editor/text-items'
import { textItemCss } from '@/lib/clips/editor/text-frame'
import { orderedStack } from '@/lib/clips/editor/layer-props'

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
  // G1a: DOM order = stacking order (export: text_items.py events / layers in the same order).
  const items = orderedStack(edits, 'text', edits.textItems ?? [])
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
            data-libass-for="text"
            data-libass-ghost="all"
            aria-hidden
          >
            <div
              className="absolute"
              style={css.anchor as CSSProperties}
              data-testid="preview-text-block"
              data-align={it.style.align}
            >
              {textDisplay(it)
                .split('\n')
                .map((line, i) => (
                  <div key={i} style={{ height: css.linePx, lineHeight: `${css.linePx}px`, whiteSpace: 'pre' }}>
                    <span
                      style={{ ...(css.text as CSSProperties), fontFamily, ...(css.box as CSSProperties | null) }}
                      className={selectedId === it.id ? 'outline outline-1 outline-dashed outline-white/70' : undefined}
                      data-testid="preview-text-line"
                    >
                      {line || ' '}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )
      })}
    </>
  )
}

'use client'

import type { CSSProperties } from 'react'
import { captionFontStack } from '@/lib/clips/caption-fonts'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { TextItem } from '@/lib/clips/editor/text-items'
import { textItemCss } from '@/lib/clips/editor/text-frame'
import { richChars } from '@/lib/clips/render-plan/text-items-ass'
import { SHAPE_LIBRARY } from '@/lib/clips/render-plan/text-shapes'
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
  underZ,
}: {
  edits: ClipEditsV2
  /** G1b: z-index of text items burned under an overlay track (`text:<id>` → z). */
  underZ?: Record<string, number>
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
        const fontFamily = css.userFamily
          ? `"${css.userFamily}", ${captionFontStack('Montserrat Black')}`
          : captionFontStack(it.style.font === 'Montserrat' ? 'Montserrat Black' : it.style.font)
        return (
          <div
            key={it.id}
            ref={(el) => elRef(it.id, el)}
            className={`pointer-events-none absolute inset-0 ${underZ?.[`text:${it.id}`] == null ? 'z-[23]' : ''}`}
            style={{ transformOrigin: css.origin, visibility: 'hidden', opacity: 0, ...(underZ?.[`text:${it.id}`] == null ? {} : { zIndex: underZ[`text:${it.id}`] }) }}
            data-testid="preview-text-item"
            data-text-id={it.id}
            data-libass-for="text"
            data-libass-ghost="all"
            aria-hidden
          >
            <div
              className="absolute"
              style={(it.kind === 'progress' ? { ...css.anchor, width: `${it.progress?.w ?? 100}%` } : css.anchor) as CSSProperties}
              data-testid="preview-text-block"
              data-align={it.style.align}
            >
              {it.kind ? (
                <ShapeSvg item={it} boxH={boxH} selected={selectedId === it.id} />
              ) : (
                richLines(it).map((runs, i) => (
                  <div key={i} style={{ height: css.rowPx, lineHeight: `${css.rowPx}px`, whiteSpace: 'pre' }}>
                    <span
                      style={{ ...(css.text as CSSProperties), fontFamily, ...(css.box as CSSProperties | null) }}
                      className={selectedId === it.id ? 'outline outline-1 outline-dashed outline-white/70' : undefined}
                      data-testid="preview-text-line"
                    >
                      {runs.length
                        ? runs.map(([t, f], k) => (
                            <span
                              key={k}
                              style={{
                                ...(css.gradient as CSSProperties | null),
                                ...(f & 1 ? { fontWeight: 900 } : {}),
                                ...(f & 2 ? { fontStyle: 'italic' } : {}),
                              }}
                              data-mark={f || undefined}
                            >
                              {t}
                            </span>
                          ))
                        : ' '}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}

/** G3b: display lines → runs of [text, mark bits] (same chars / marks the ASS burns). */
function richLines(it: TextItem): [string, number][][] {
  const lines: [string, number][][] = [[]]
  for (const [c, f] of richChars(it as unknown as Record<string, unknown>, it.style.case === 'upper')) {
    if (c === '\n') {
      lines.push([])
      continue
    }
    const cur = lines[lines.length - 1]!
    const last = cur[cur.length - 1]
    if (last && last[1] === f) last[0] += c
    else cur.push([c, f])
  }
  return lines
}

/** ASS drawing (unit box 0..1000: m / l / b) → SVG path. */
export function assPathToSvg(d: string): string {
  const out: string[] = []
  let started = false
  for (const tok of d.split(/\s+/).filter(Boolean)) {
    if (tok === 'm') {
      if (started) out.push('Z')
      started = true
      out.push('M')
    } else if (tok === 'l') out.push('L')
    else if (tok === 'b') out.push('C')
    else out.push(tok)
  }
  if (started) out.push('Z')
  return out.join(' ')
}

/** DOM stand-in for a shape / sticker / progress bar (libass draws the real one; this is the hit box). */
function ShapeSvg({ item, boxH, selected }: { item: TextItem; boxH: number; selected: boolean }) {
  const k = boxH / 1920
  const st = item.style
  let w: number | string
  let h: number
  let parts: [string, string][] = []
  if (item.kind === 'shape' && item.shape) {
    w = item.shape.w * k
    h = item.shape.h * k
    const d = SHAPE_LIBRARY.shapes[item.shape.type]?.d
    if (d) parts = [[st.color, d]]
  } else if (item.kind === 'sticker' && item.sticker) {
    w = h = st.size * k
    parts = (SHAPE_LIBRARY.stickers[item.sticker]?.parts ?? []).map((p) => [p.c ?? st.color, p.d])
  } else {
    const p = item.progress ?? { w: 100, h: 16, trackOpacity: 35 }
    return (
      <div
        style={{ width: '100%', height: p.h * k, background: st.color }}
        className={selected ? 'outline outline-1 outline-dashed outline-white/70' : undefined}
        data-testid="preview-shape"
        data-kind="progress"
      />
    )
  }
  const stroke = st.stroke && st.stroke.width > 0 ? { stroke: st.stroke.color, strokeWidth: 2 * st.stroke.width * k } : {}
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      overflow="visible"
      className={selected ? 'outline outline-1 outline-dashed outline-white/70' : undefined}
      data-testid="preview-shape"
      data-kind={item.kind}
    >
      {parts.map(([c, d], i) => (
        <path key={i} d={assPathToSvg(d)} fill={c} {...stroke} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  )
}

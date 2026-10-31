'use client'

import { useMemo } from 'react'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { isIdentitySpec, lookForSpec, lookKey, svgCurveTables, svgMatrixValues, type ColorSpec } from '@/lib/clips/editor/color'

export function lookFilterId(key: string): string {
  return `e4look-${key}`
}

/** CSS `filter` value for a spec ('' = none). */
export function lookFilterCss(spec: ColorSpec | undefined | null): string {
  if (!spec || isIdentitySpec(spec)) return ''
  return `url(#${lookFilterId(lookKey(spec))})`
}

/** Every distinct look the clip uses (video, per item, B-roll) plus an optional live one (panel drag). */
export function usedSpecs(edits: ClipEditsV2, extra?: ColorSpec | null): ColorSpec[] {
  const c = edits.color
  const all: ColorSpec[] = []
  if (c?.video) all.push(c.video)
  for (const s of c?.segments ?? []) all.push(s.spec)
  for (const s of Object.values(c?.broll ?? {})) all.push(s)
  if (extra) all.push(extra)
  const seen = new Set<string>()
  return all.filter((s) => {
    if (isIdentitySpec(s)) return false
    const k = lookKey(s)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/**
 * E4 color preview: one SVG filter per look — feColorMatrix (M | o) then feComponentTransfer tables,
 * in sRGB (color-interpolation-filters), i.e. exactly color.ts applyLook, which the export samples
 * into a .cube for ffmpeg lut3d.
 */
export function ColorLookDefs({ specs }: { specs: ColorSpec[] }) {
  const defs = useMemo(
    () =>
      specs.map((s) => {
        const look = lookForSpec(s)
        return { id: lookFilterId(lookKey(s)), matrix: svgMatrixValues(look), curve: svgCurveTables(look) }
      }),
    [specs],
  )
  if (!defs.length) return null
  return (
    <svg width="0" height="0" className="pointer-events-none absolute" aria-hidden data-testid="color-look-defs">
      <defs>
        {defs.map((d) => (
          <filter key={d.id} id={d.id} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
            <feColorMatrix type="matrix" values={d.matrix} />
            {d.curve ? (
              <feComponentTransfer>
                <feFuncR type="table" tableValues={d.curve[0]} />
                <feFuncG type="table" tableValues={d.curve[1]} />
                <feFuncB type="table" tableValues={d.curve[2]} />
              </feComponentTransfer>
            ) : null}
          </filter>
        ))}
      </defs>
    </svg>
  )
}

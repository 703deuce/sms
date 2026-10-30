import type { FacecamBox } from '@/lib/clips/facecam-geometry'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { T6Signals } from '@/lib/clips/templates/signals'
import { T6_TEMPLATES_BY_ID, type TemplateDef } from '@/lib/clips/templates/registry'

export type TemplateSpecV2 = {
  v: 2
  kind: 'template'
  templateId: string
  playW: number
  playH: number
  panels: { dest: { x: number; y: number; w: number; h: number }; src: FacecamBox; fit: string }[]
  bands: unknown[]
  pip: unknown
  titleRect: { x: number; y: number; w: number; h: number } | null
  captionRect: { x: number; y: number; w: number; h: number }
  avoidRects: unknown[]
}

const DEFAULT_FACECAM: FacecamBox = { x: 0.02, y: 0.02, w: 0.32, h: 0.28 }
const DEFAULT_FULL: FacecamBox = { x: 0, y: 0, w: 1, h: 1 }

function even(n: number): number {
  const v = Math.round(n)
  return v - (v % 2)
}

function srcBox(name: string, signals: T6Signals, edits: ClipEditsV2): FacecamBox {
  const tmpl = edits.layout.template
  const boxes = tmpl?.boxes
  if (boxes && name in boxes && boxes[name as keyof typeof boxes]) {
    return boxes[name as keyof typeof boxes]!
  }
  if (name === 'facecam_box') return signals.facecam_box ?? edits.layout.facecam?.box ?? DEFAULT_FACECAM
  if (name === 'full') return DEFAULT_FULL
  return DEFAULT_FULL
}

export function resolveTemplateGeometry(
  t: TemplateDef,
  s: T6Signals,
  edits: ClipEditsV2,
  playW = 1080,
  playH = 1920,
): TemplateSpecV2 {
  let yCursor = 0
  const panels = t.panels.map((p, idx) => {
    const destH =
      idx < t.panels.length - 1 ? even(playH * p.h) : playH - yCursor
    const destY = idx === 0 ? even(playH * p.y) : yCursor
    const destW = even(playW * (p.w ?? 1))
    const destX = even(playW * (p.x ?? 0))
    yCursor = destY + destH
    return {
      dest: { x: destX, y: destY, w: destW, h: destH },
      src: srcBox(p.src, s, edits),
      fit: p.fit,
    }
  })
  const capY = t.captions?.y ?? 0.65
  return {
    v: 2,
    kind: 'template',
    templateId: t.id,
    playW,
    playH,
    panels,
    bands: t.bands ?? [],
    pip: t.pip ?? null,
    titleRect: null,
    captionRect: { x: 0, y: even(playH * capY), w: playW, h: even(playH * 0.12) },
    avoidRects: [],
  }
}

export function resolveTemplateGeometryById(
  id: string,
  s: T6Signals,
  edits: ClipEditsV2,
): TemplateSpecV2 | null {
  const t = T6_TEMPLATES_BY_ID[id]
  if (!t) return null
  return resolveTemplateGeometry(t, s, edits)
}

/**
 * Compatibility bridge from vetted AI graphics plans to the EXISTING clip editor
 * Text lane, preview, autosave, and FFmpeg burn-in engine. This does not render new
 * graphic types: deliberately refuse unsupported templates instead of claiming
 * every motion profile already works.
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { normalizeTextItems, TEXT_MAX_ITEMS, TEXT_MAX_CHARS } from '@/lib/clips/editor/text-items'
import type { TextItem } from '@/lib/clips/editor/text-items'
import type { TextAnim, TextAnimEdge } from '@/lib/clips/render-plan/text-anim'
import { validateMotionPlan, type MotionPlan, type MotionGraphic } from './contract'
import { expandedShapeGraphic, isGraphicItemId } from './primitives'

/** Existing worker's two engines use the same `edits.textItems` schema. */
export const TEXT_BACKED_TEMPLATES = [
  'kinetic_type', 'lower_third', 'callout', 'stat_counter',
  'steps', 'title_card', 'gaming_highlight', 'diagram', 'bar_chart',
] as const

const supportsText = new Set<string>(TEXT_BACKED_TEMPLATES)
type ApplyResult =
  | { ok: true; edits: ClipEditsV2; addedIds: string[] }
  | { ok: false; code: string; detail: string }

function edge(a: MotionGraphic['intro']): TextAnimEdge | undefined {
  if (a.kind === 'none' || a.durationMs === 0) return undefined
  const type: TextAnimEdge['type'] =
    a.kind === 'fade' ? 'fade' :
    a.kind === 'slide' ? 'slide_up' :
    a.kind === 'scale' || a.kind === 'count_up' ? 'pop' :
    a.kind === 'type_on' ? 'typewriter' : 'fade'
  return { type, unit: type === 'typewriter' ? 'char' : 'block',
    durMs: Math.min(5000, Math.max(100, a.durationMs)) }
}
function animation(g: MotionGraphic): TextAnim | undefined {
  const intro = edge(g.intro), outro = edge(g.outro)
  const value: TextAnim = {}
  if (intro) value.in = intro
  if (outro) value.out = outro
  return Object.keys(value).length ? value : undefined
}
function asText(g: MotionGraphic): TextItem {
  // Only fonts shipped in BOTH the browser and CPU worker can be used here.
  const permitted = new Set(['Montserrat', 'Anton', 'Poppins', 'Bangers', 'Bebas Neue', 'Archivo Black', 'Luckiest Guy'])
  const font = permitted.has(g.style.fontFamily) ? g.style.fontFamily as TextItem['style']['font'] : 'Montserrat'
  const align = g.templateId === 'lower_third' ? 'left' : 'center'
  return {
    id: 'mg_' + g.id, text: g.text!,
    startMs: g.startMs, endMs: g.endMs,
    x: Math.round((g.box.x + g.box.width / 2) * 1000) / 10,
    y: Math.round((g.box.y + g.box.height / 2) * 1000) / 10,
    style: {
      font, size: Math.max(24, Math.min(240, Math.round(g.box.height * 1920 * 0.45))),
      color: g.style.textColor, align, case: 'none',
      ...(g.templateId === 'lower_third' || g.templateId === 'callout'
        ? { box: { color: g.style.backgroundColor ?? '#0F172A', opacity: 78, pad: 12 } }
        : { stroke: { color: '#000000', width: 5 } }),
    },
    anim: animation(g),
  }
}

/**
 * Explicitly rejects unsupported components and failed normalization; never
 * silently drops a graphic, replaces user-added text, or changes the EDL.
 * Caller owns persistence via the established editor save pipeline.
 */
export function addTextBackedMotionPlan(
  edits: ClipEditsV2, rawPlan: unknown,
  options: { safeRect?: { x: number; y: number; width: number; height: number };
    evidenceIds?: ReadonlySet<string> } = {},
): ApplyResult {
  const validation = validateMotionPlan(rawPlan, options)
  if (!validation.ok) return { ok: false, code: 'invalid_plan', detail: JSON.stringify(validation.issues) }
  const plan: MotionPlan = validation.plan
  for (const g of plan.graphics) {
    if (!supportsText.has(g.templateId)) return { ok: false, code: 'unsupported_template', detail: g.templateId }
    if (g.templateId !== 'diagram' && g.templateId !== 'bar_chart' &&
        (!g.text?.trim() || Array.from(g.text).length > TEXT_MAX_CHARS))
      return { ok: false, code: 'missing_or_long_text', detail: g.id }
    if (g.keyframes.length) return { ok: false, code: 'custom_keyframes_not_mapped', detail: g.id }
    if (g.intro.kind === 'draw' || g.outro.kind === 'draw' || g.intro.kind === 'count_up' ||
        g.outro.kind === 'count_up' || g.intro.kind === 'type_on' && g.templateId !== 'kinetic_type')
      return { ok: false, code: 'unsupported_animation', detail: g.id }
  }
  const prev = edits.textItems ?? []
  // Updated AI graphics with the same IDs are replaced, while ALL manually
  // created text items and unrelated AI graphics survive unmodified.
  const retained = prev.filter(t => !plan.graphics.some(g => isGraphicItemId(t.id, g.id)))
  let generated: TextItem[]
  try {
    generated = plan.graphics.flatMap(g =>
      g.templateId === 'diagram' || g.templateId === 'bar_chart'
        ? expandedShapeGraphic(g, plan.format) : [asText(g)])
  } catch (err) {
    return { ok: false, code: 'invalid_shape_data', detail: String((err as Error).message) }
  }
  if (retained.length + generated.length > TEXT_MAX_ITEMS)
    return { ok: false, code: 'text_capacity', detail: 'Existing text item limit exceeded' }
  const items = [...retained, ...generated]
  const normalized = normalizeTextItems(items, plan.durationMs) ?? []
  if (normalized.length !== items.length)
    return { ok: false, code: 'text_normalization_failed', detail: 'One or more items cannot be rendered' }
  return { ok: true, edits: { ...edits, textItems: normalized },
    addedIds: generated.map(g => g.id) }
}

/** Remove only generated graphics; manual text, captions and EDL stay untouched. */
export function removeTextBackedMotionGraphics(edits: ClipEditsV2, ids: readonly string[]): ClipEditsV2 {
  return { ...edits, textItems: edits.textItems?.filter(item => !ids.some(id => isGraphicItemId(item.id, id))) }
}

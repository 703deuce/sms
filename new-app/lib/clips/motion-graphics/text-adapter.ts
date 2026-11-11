/**
 * Compatibility bridge from vetted AI graphics plans to the EXISTING clip editor
 * Text lane, preview, autosave, and FFmpeg burn-in engine. This does not render new
 * graphic types: deliberately refuse unsupported templates instead of claiming
 * every motion profile already works.
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { normalizeTextItems, TEXT_FONTS, TEXT_MAX_ITEMS, TEXT_MAX_CHARS } from '@/lib/clips/editor/text-items'
import { findClipFont } from '@/lib/clips/font-manifest'
import type { TextItem } from '@/lib/clips/editor/text-items'
import type { TextAnim, TextAnimEdge } from '@/lib/clips/render-plan/text-anim'
import { validateMotionPlan, type MotionPlan, type MotionGraphic } from './contract'
import { expandedShapeGraphic, isGraphicItemId } from './primitives'
import { motionKeyframeTracks } from './keyframe-adapter'
import { fitMotionTextToBox } from './text-fit'

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
const MOTION_RENDER_FONTS = new Set<string>(TEXT_FONTS.map(face => face.id).filter(id => findClipFont(id)))
/** Reject unshipped families rather than silently exporting Montserrat in their place. */
function motionFont(g: MotionGraphic): TextItem['style']['font'] {
  if (!MOTION_RENDER_FONTS.has(g.style.fontFamily)) throw new Error('motion_font_unavailable:' + g.style.fontFamily)
  return g.style.fontFamily as TextItem['style']['font']
}
function asText(g: MotionGraphic, format: MotionPlan['format']): TextItem {
  const font = motionFont(g)
  const align = g.templateId === 'lower_third' ? 'left' : 'center'
  const boxed = g.templateId === 'lower_third' || g.templateId === 'callout'
  const fit = fitMotionTextToBox({
    text: g.text!,
    fontFamily: font,
    format,
    box: g.box,
    preferredSize: g.box.height * 1920 * 0.45,
    edgeInsetPx: boxed ? 18 : 12,
  })
  if (!fit.fits) throw new Error('motion_text_does_not_fit:' + g.id)
  return {
    id: 'mg_' + g.id, text: fit.text,
    startMs: g.startMs, endMs: g.endMs,
    x: Math.round((g.box.x + g.box.width / 2) * 1000) / 10,
    y: Math.round((g.box.y + g.box.height / 2) * 1000) / 10,
    style: {
      font, size: fit.size,
      color: g.style.textColor, align, case: 'none',
      ...(boxed
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
    if (g.intro.kind === 'draw' || g.outro.kind === 'draw' || g.intro.kind === 'count_up' ||
        g.outro.kind === 'count_up' || g.intro.kind === 'type_on' && g.templateId !== 'kinetic_type')
      return { ok: false, code: 'unsupported_animation', detail: g.id }
  }
  const prev = edits.textItems ?? []
  // Updated AI graphics with the same IDs are replaced, while ALL manually
  // created text items and unrelated AI graphics survive unmodified.
  // Only a previously approved motion plan can authorize replacing generated IDs.
  // A manually created Text item with the same prefix must never be overwritten.
  const previouslyApprovedIds = new Set(edits.motionPlan?.graphics.map(g => g.id) ?? [])
  const retained = prev.filter(t => !plan.graphics.some(g =>
    previouslyApprovedIds.has(g.id) && isGraphicItemId(t.id, g.id)))
  let generated: TextItem[]
  let generatedKeyframes: NonNullable<ClipEditsV2['keyframes']>
  try {
    const groups = plan.graphics.map(g => ({ graphic: g,
      items: g.templateId === 'diagram' || g.templateId === 'bar_chart'
        ? expandedShapeGraphic(g, plan.format, motionFont(g)) : [asText(g, plan.format)] }))
    generated = groups.flatMap(group => group.items)
    generatedKeyframes = groups.flatMap(group =>
      motionKeyframeTracks(group.graphic, group.items.map(item => item.id)))
  } catch (err) {
    return { ok: false, code: 'invalid_shape_data', detail: String((err as Error).message) }
  }
  if (retained.length + generated.length > TEXT_MAX_ITEMS)
    return { ok: false, code: 'text_capacity', detail: 'Existing text item limit exceeded' }
  if (generated.some(g => retained.some(t => t.id === g.id)))
    return { ok: false, code: 'id_collision', detail: 'Existing editable Text item uses a generated graphic ID' }
  const items = [...retained, ...generated]
  const normalized = normalizeTextItems(items, plan.durationMs) ?? []
  if (normalized.length !== items.length)
    return { ok: false, code: 'text_normalization_failed', detail: 'One or more items cannot be rendered' }
  const previousTracks = (edits.keyframes ?? []).filter(track =>
    !track.target.startsWith('text:') ||
    !plan.graphics.some(g => previouslyApprovedIds.has(g.id) &&
      isGraphicItemId(track.target.slice(5), g.id)))
  return { ok: true, edits: { ...edits, textItems: normalized,
    keyframes: [...previousTracks, ...generatedKeyframes] },
    addedIds: generated.map(g => g.id) }
}

/** Remove only generated graphics; manual text, captions and EDL stay untouched. */
export function removeTextBackedMotionGraphics(edits: ClipEditsV2, ids: readonly string[]): ClipEditsV2 {
  const approved = new Set(edits.motionPlan?.graphics.map(g => g.id) ?? [])
  const owned = (itemId: string) => ids.some(id => approved.has(id) && isGraphicItemId(itemId, id))
  return { ...edits,
    textItems: edits.textItems?.filter(item => !owned(item.id)),
    keyframes: edits.keyframes?.filter(track =>
      !track.target.startsWith('text:') || !owned(track.target.slice(5))),
  }
}

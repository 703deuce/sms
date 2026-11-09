/**
 * Shared, non-executable contract for future AI motion graphics.
 * All times refer to the APPROVED OUTPUT timeline, not source timestamps.
 * This module deliberately does not change existing edit, preview, or render paths.
 */
import { z } from 'zod'

export const MotionModeSchema = z.enum([
  'single_source_story', 'multi_source_story', 'clean_take',
  'streamer_continuous', 'streamer_story_clip', 'streamer_long_form',
])
export type MotionMode = z.infer<typeof MotionModeSchema>

const Id = z.string().min(1).max(128).regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/)
const Unit = z.number().finite().min(0).max(1)
const Color = z.string().regex(/^#[0-9a-fA-F]{6}$/)
const Rect = z.object({ x: Unit, y: Unit, width: Unit, height: Unit }).strict()
const Animation = z.object({
  kind: z.enum(['none', 'fade', 'slide', 'scale', 'type_on', 'count_up', 'draw']),
  durationMs: z.number().int().min(0).max(10000),
  easing: z.enum(['linear', 'in', 'out', 'inOut']).default('inOut'),
}).strict()
const Frame = z.object({
  atMs: z.number().int().min(0),
  x: z.number().finite().min(-1).max(2).optional(),
  y: z.number().finite().min(-1).max(2).optional(),
  scale: z.number().finite().min(0.01).max(8).optional(),
  rotation: z.number().finite().min(-360).max(360).optional(),
  opacity: Unit.optional(),
}).strict()
export const MotionGraphicSchema = z.object({
  id: Id,
  templateId: z.enum([
    'kinetic_type', 'lower_third', 'callout', 'stat_counter',
    'steps', 'diagram', 'screen_frame', 'presenter_window',
    'gaming_highlight', 'title_card',
  ]),
  startMs: z.number().int().min(0),
  endMs: z.number().int().positive(),
  beatId: Id.optional(),
  sourceEvidenceId: Id.optional(),
  text: z.string().max(400).optional(),
  box: Rect,
  zIndex: z.number().int().min(0).max(1000),
  style: z.object({
    textColor: Color,
    accentColor: Color,
    backgroundColor: Color.optional(),
    fontFamily: z.string().min(1).max(100),
  }).strict(),
  intro: Animation,
  outro: Animation,
  keyframes: z.array(Frame).max(100).default([]),
  assetIds: z.array(Id).max(20).default([]),
  rationale: z.string().min(1).max(400),
}).strict()
export type MotionGraphic = z.infer<typeof MotionGraphicSchema>

export const MotionPlanSchema = z.object({
  version: z.literal(1),
  mode: MotionModeSchema,
  styleProfileId: Id.nullable(),
  fps: z.union([z.literal(24), z.literal(25), z.literal(30), z.literal(50), z.literal(60)]),
  durationMs: z.number().int().positive(),
  format: z.enum(['9:16', '16:9', '1:1']),
  graphics: z.array(MotionGraphicSchema).max(150),
}).strict()
export type MotionPlan = z.infer<typeof MotionPlanSchema>

export const StyleProfileSchema = z.object({
  version: z.literal(1),
  id: Id,
  name: z.string().min(1).max(100),
  brandColors: z.array(Color).min(1).max(12),
  fontFamilies: z.array(z.string().min(1).max(100)).min(1).max(8),
  templateIds: z.array(MotionGraphicSchema.shape.templateId).min(1).max(10),
  motionDensity: z.enum(['minimal', 'balanced', 'dynamic']),
  references: z.array(z.object({
    id: Id,
    kind: z.enum(['uploaded_image', 'uploaded_video', 'authorized_link']),
    assetId: Id.optional(),
    authorizedUrlId: Id.optional(),
  }).strict()).max(30),
  instructions: z.string().max(2000),
}).strict()
export type StyleProfile = z.infer<typeof StyleProfileSchema>

export type MotionPlanIssue = { graphicId?: string; code: string; message: string }
/**
 * Deterministic editorial gate; never render or persist a model's raw output
 * unless both schema and contextual validation pass.
 */
export function validateMotionPlan(
  raw: unknown,
  opts: { safeRect?: { x: number; y: number; width: number; height: number }; evidenceIds?: ReadonlySet<string> } = {},
): { ok: true; plan: MotionPlan } | { ok: false; issues: MotionPlanIssue[] } {
  const parsed = MotionPlanSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, issues: parsed.error.issues.map(i => ({
    code: 'schema', message: i.path.join('.') + ': ' + i.message,
  })) }
  const plan = parsed.data
  const issues: MotionPlanIssue[] = []
  const seen = new Set<string>()
  const safe = opts.safeRect ?? { x: 0, y: 0, width: 1, height: 1 }
  const maxX = safe.x + safe.width, maxY = safe.y + safe.height
  if (![safe.x, safe.y, safe.width, safe.height].every(Number.isFinite) ||
      safe.width <= 0 || safe.height <= 0 || safe.x < 0 || safe.y < 0 ||
      maxX > 1 || maxY > 1) {
    return { ok: false, issues: [{ code: 'invalid_safe_rect', message: 'Safe rect must fit the unit canvas' }] }
  }
  for (const graphic of plan.graphics) {
    const add = (code: string, message: string) => issues.push({ graphicId: graphic.id, code, message })
    if (seen.has(graphic.id)) add('duplicate_id', 'Graphic IDs must be unique')
    seen.add(graphic.id)
    if (graphic.endMs <= graphic.startMs || graphic.endMs > plan.durationMs)
      add('invalid_interval', 'Graphic must occupy a positive interval within output duration')
    if (graphic.intro.durationMs + graphic.outro.durationMs > graphic.endMs - graphic.startMs)
      add('animation_overflow', 'Entry and exit animations exceed graphic duration')
    const b = graphic.box
    if (b.width <= 0 || b.height <= 0 || b.x + b.width > 1 || b.y + b.height > 1)
      add('invalid_box', 'Graphic box must fit output canvas')
    if (b.x < safe.x || b.y < safe.y || b.x + b.width > maxX || b.y + b.height > maxY)
      add('outside_safe_zone', 'Graphic must fit selected platform safe zone')
    if (opts.evidenceIds && graphic.sourceEvidenceId && !opts.evidenceIds.has(graphic.sourceEvidenceId))
      add('unverified_evidence', 'Graphic references missing evidence')
    let last = -1
    for (const key of graphic.keyframes) {
      if (key.atMs <= last || key.atMs > graphic.endMs - graphic.startMs)
        add('invalid_keyframe', 'Keyframes must be strictly increasing and item-local')
      last = key.atMs
    }
  }
  return issues.length ? { ok: false, issues } : { ok: true, plan }
}

/** Applies feedback only to selected IDs; rejects invented IDs and protects other graphics. */
export function patchMotionGraphics(
  plan: MotionPlan,
  patches: ReadonlyArray<{ id: string; patch: Partial<MotionGraphic> }>,
): ReturnType<typeof validateMotionPlan> {
  const ids = new Set(plan.graphics.map(g => g.id))
  const modified = new Set<string>()
  for (const item of patches) {
    if (!ids.has(item.id) || modified.has(item.id) || item.patch.id && item.patch.id !== item.id)
      return { ok: false, issues: [{ graphicId: item.id, code: 'invalid_patch', message: 'Unknown, duplicate or renamed target ID' }] }
    modified.add(item.id)
  }
  const next = { ...plan, graphics: plan.graphics.map(g => {
    const change = patches.find(p => p.id === g.id)
    return change ? { ...g, ...change.patch } : g
  }) }
  return validateMotionPlan(next)
}

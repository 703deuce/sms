/**
 * BE-10 / FE-7: AI Director chat edits, expressed as typed operations on the film's blueprint.
 *
 * A Motion Studio film is built from the same things as the GameStop and Chief Keef reference films
 * (round2_cinematic/gme/scene.py, keef/scene.py, the insert tests, music.py): ONE world (type + look), scenes that
 * each show one hero per line, emphasis words where hits land on the spoken word, a camera path, footage inserts
 * (approach -> play -> return / hard cut) and a score with anchors (pulse, build, peak, crash, resolve). The Director
 * proposes edits to exactly those pieces; accepting applies them to the plan and re-renders only what they touch:
 *
 *   scene / emphasis / camera        -> that scene's segment
 *   world / look (mood, grain, glow) -> every graphics segment (palette also re-colours footage frames)
 *   footage insert timing / surface  -> that insert (program re-timed; unchanged segments are cache hits)
 *   music anchors / source           -> re-mix only (no segment renders)
 *   script / narration wording       -> story revision (unchanged scenes reuse their renders)
 *
 * Pure module: no server imports, so it is unit-tested directly.
 */

export const WORLD_TYPES = ['map', 'price_chart', 'timeline', 'evidence_board', 'network', 'document_desk', 'abstract_field', 'city_grid'] as const
export const VISUAL_TYPES = ['title', 'data', 'map', 'timeline', 'photo', 'document', 'diagram', 'quote', 'abstract'] as const
export const SURFACES = ['photo', 'tv', 'newspaper'] as const
export const EXIT_STYLES = ['mirror', 'asymmetric'] as const
export const ANCHORS = ['pulse', 'build', 'peak', 'crash', 'resolve'] as const
const PALETTE_KEYS = ['bg', 'ink', 'accent', 'accent2', 'muted'] as const

export type AnchorKey = (typeof ANCHORS)[number]
export type DirectorOp =
  | { type: 'scene'; sceneIndex: number; description?: string; visualType?: string; camera?: string; note?: string }
  | { type: 'emphasis'; sceneIndex: number; emphasis: { lineId: string; word: string }[] }
  | { type: 'world'; worldType: string; reason?: string }
  | { type: 'style'; palette?: Partial<Record<(typeof PALETTE_KEYS)[number], string>>; mood?: string; grain?: number; glow?: number; vignette?: number }
  | { type: 'footage'; sceneIndex: number; inS?: number; outS?: number; surface?: string; exitStyle?: string; audioMode?: string; assetId?: string }
  | { type: 'music'; anchors?: Partial<Record<AnchorKey, { lineId: string; word: string | null } | null>>; source?: 'generated' | 'none' | 'upload' }
  | { type: 'story'; note: string }

export type DirectorItem = { text: string; effect: string; op: DirectorOp }

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const J = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {})
const A = (v: unknown): any[] => (Array.isArray(v) ? v : []) // eslint-disable-line @typescript-eslint/no-explicit-any
const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

// ------------------------------------------------------------------------------------------------ blueprint
export type BlueprintScene = {
  index: number
  kind: 'graphics' | 'handoff' | 'hardcut'
  visualType: string
  description: string
  camera: string | null
  lines: { id: string; text: string; hero: string }[]
  emphasis: { lineId: string; word: string }[]
  startMs: number | null
  endMs: number | null
  handoff: { assetId: string; inS: number; outS: number; surface: string; exitStyle: string; audioMode: string } | null
}
export type Blueprint = {
  title: string
  world: { type: string; reason: string }
  style: { palette: Record<string, string>; mood: string; grain: number | null; glow: number | null; vignette: number | null }
  musicSource: string
  musicUploadAvailable: boolean
  musicAnchors: Partial<Record<AnchorKey, { lineId: string; word: string | null }>>
  scenes: BlueprintScene[]
  footage: { assetId: string; filename: string; durationS: number; summary: string }[]
  lineIds: string[]
}

export type SceneRowLike = { id: string; index: number; kind: string; visualType: string; plan: unknown; startMs?: number | null; endMs?: number | null }
export type AssetLike = { id: string; kind: string; filename: string; durationMs?: number | null; analysis?: unknown }

export function buildBlueprint(input: { plan: unknown; story: unknown; scenes: SceneRowLike[]; assets: AssetLike[]; settings: unknown; title?: string }): Blueprint {
  const plan = J(input.plan)
  const story = J(input.story)
  const settings = J(input.settings)
  const lines = A(story.lines).map(J)
  const byLine = new Map(lines.map(l => [String(l.id), l]))
  const rowByIndex = new Map(input.scenes.map(r => [r.index, r]))
  const planScenes = A(plan.scenes).map(J)
  const scenes: BlueprintScene[] = planScenes.map((ps, k) => {
    const index = Number.isInteger(ps.index) ? ps.index : k
    const row = rowByIndex.get(index)
    const rp = J(row?.plan)
    const kind = (['handoff', 'hardcut'].includes(ps.kind) ? ps.kind : 'graphics') as BlueprintScene['kind']
    const h: Json | null = kind === 'graphics' ? null : { ...J(ps.handoff), ...(J(rp.handoff).assetId ? { assetId: J(rp.handoff).assetId } : {}) }
    const ids = A(ps.lineIds).map(String)
    return {
      index, kind,
      visualType: s(row?.visualType || ps.visualType, 40) || 'abstract',
      description: s(rp.description ?? ps.description, 600),
      camera: s(rp.cameraOverride, 200) || s(ps.camera, 200) || null,
      lines: ids.filter(id => byLine.has(id)).map(id => ({ id, text: s(byLine.get(id)!.text, 400), hero: s(byLine.get(id)!.hero, 80) })),
      emphasis: A(ps.emphasis).map(J).filter(e => e.lineId && e.word).map(e => ({ lineId: String(e.lineId), word: String(e.word) })),
      startMs: row?.endMs ? row.startMs ?? null : null,
      endMs: row?.endMs ?? null,
      handoff: h ? { assetId: String(h.assetId ?? ''), inS: num(h.inS) ?? 0, outS: num(h.outS) ?? 0, surface: s(h.surface, 20) || 'photo',
        exitStyle: s(h.exitStyle, 20) || 'mirror', audioMode: s(h.audioMode, 10) || (ids.length ? 'bed' : 'clip') } : null,
    }
  })
  const st = J(plan.style)
  const anchors: Blueprint['musicAnchors'] = {}
  for (const k of ANCHORS) {
    const a = J(J(plan.musicAnchors)[k])
    if (a.lineId) anchors[k] = { lineId: String(a.lineId), word: a.word ? String(a.word) : null }
  }
  return {
    title: s(input.title || story.title, 160),
    world: { type: s(J(plan.world).type, 40), reason: s(J(plan.world).reason, 300) },
    style: { palette: Object.fromEntries(PALETTE_KEYS.map(k => [k, s(J(st.palette)[k], 9)])), mood: s(st.mood, 80),
      grain: num(st.grain), glow: num(st.glow), vignette: num(st.vignette) },
    musicSource: s(plan.musicSource, 20) || s(settings.music, 20) || 'generated',
    musicUploadAvailable: Boolean(settings.musicUploadKey),
    musicAnchors: anchors,
    scenes,
    footage: input.assets.filter(a => a.kind === 'video').map(a => ({ assetId: a.id, filename: s(a.filename, 120),
      durationS: Math.round((Number(a.durationMs) || 0) / 100) / 10, summary: s(J(a.analysis).summary, 240) })),
    lineIds: lines.map(l => String(l.id)),
  }
}

// ------------------------------------------------------------------------------------------------ validation
/** Never show a currency sign in the UI: "$483" -> "483 dollars", "$2.75B" -> "2.75 billion dollars". */
export function noCurrency(text: string): string {
  const unit: Record<string, string> = { b: ' billion', bn: ' billion', billion: ' billion', m: ' million', million: ' million', k: ' thousand', thousand: ' thousand' }
  return text
    .replace(/\$\s?(\d[\d,]*(?:\.\d+)?)\s?(billion|million|thousand|bn|b|m|k)?\b/gi, (_, n: string, u?: string) => `${n}${u ? unit[u.toLowerCase()] ?? '' : ''} dollars`)
    .replace(/\$/g, '')
}

function wordInLine(word: string, text: string): boolean {
  const w = norm(word.split(/\s+/)[0] ?? '')
  return Boolean(w) && text.split(/\s+/).some(t => norm(t) === w)
}

export type ValidationResult = { items: DirectorItem[]; dropped: string[] }

export function validateItems(raw: unknown, bp: Blueprint): ValidationResult {
  const items: DirectorItem[] = []
  const dropped: string[] = []
  const sceneAt = (i: unknown) => { const n = num(i); return n == null ? undefined : bp.scenes.find(x => x.index === Math.round(n)) }
  for (const r of A(raw).slice(0, 8)) {
    const it = J(r)
    const o = J(it.op)
    const text = noCurrency(s(it.text, 240))
    const why = (m: string) => dropped.push(`${String(o.type ?? '?')}: ${m}`)
    if (!text) { why('no description'); continue }
    let op: DirectorOp | null = null
    switch (o.type) {
      case 'scene': {
        const sc = sceneAt(o.sceneIndex)
        if (!sc) { why('unknown scene'); break }
        const vt = s(o.visualType, 40)
        const next: DirectorOp = { type: 'scene', sceneIndex: sc.index,
          ...(s(o.description, 600) ? { description: s(o.description, 600) } : {}),
          ...(vt && sc.kind === 'graphics' && (VISUAL_TYPES as readonly string[]).includes(vt) ? { visualType: vt } : {}),
          ...(s(o.camera, 200) ? { camera: s(o.camera, 200) } : {}),
          ...(s(o.note, 600) ? { note: s(o.note, 600) } : {}) }
        if (Object.keys(next).length <= 2) { why('nothing to change'); break }
        if (sc.kind !== 'graphics') { why('footage inserts change through footage ops'); break }
        op = next
        break
      }
      case 'emphasis': {
        const sc = sceneAt(o.sceneIndex)
        if (!sc || sc.kind !== 'graphics') { why('emphasis needs a graphics scene'); break }
        const em = A(o.emphasis).map(J).map(e => ({ lineId: String(e.lineId ?? ''), word: s(e.word, 40) }))
          .filter(e => { const l = sc.lines.find(x => x.id === e.lineId); return l && wordInLine(e.word, l.text) })
        if (!em.length) { why('emphasis words must be spoken in that scene'); break }
        op = { type: 'emphasis', sceneIndex: sc.index, emphasis: em.slice(0, 8) }
        break
      }
      case 'world': {
        const wt = s(o.worldType, 40)
        if (!(WORLD_TYPES as readonly string[]).includes(wt) || wt === bp.world.type) { why('unknown or unchanged world'); break }
        op = { type: 'world', worldType: wt, ...(s(o.reason, 300) ? { reason: s(o.reason, 300) } : {}) }
        break
      }
      case 'style': {
        const pal: Record<string, string> = {}
        for (const k of PALETTE_KEYS) { const v = s(J(o.palette)[k], 9); if (/^#[0-9a-fA-F]{6}$/.test(v)) pal[k] = v.toLowerCase() }
        const next: DirectorOp = { type: 'style', ...(Object.keys(pal).length ? { palette: pal } : {}),
          ...(s(o.mood, 80) ? { mood: s(o.mood, 80) } : {}),
          ...(num(o.grain) != null ? { grain: clamp(num(o.grain)!, 0, 0.2) } : {}),
          ...(num(o.glow) != null ? { glow: clamp(num(o.glow)!, 0, 1) } : {}),
          ...(num(o.vignette) != null ? { vignette: clamp(num(o.vignette)!, 0, 1) } : {}) }
        if (Object.keys(next).length <= 1) { why('nothing to change'); break }
        op = next
        break
      }
      case 'footage': {
        const sc = sceneAt(o.sceneIndex)
        if (!sc || !sc.handoff) { why('not a footage insert'); break }
        const assetId = s(o.assetId, 64) || sc.handoff.assetId
        const asset = bp.footage.find(f => f.assetId === assetId)
        if (!asset) { why('unknown footage'); break }
        const inS = num(o.inS) ?? (assetId === sc.handoff.assetId ? sc.handoff.inS : 0)
        const outS = num(o.outS) ?? (assetId === sc.handoff.assetId ? sc.handoff.outS : Math.min(asset.durationS, inS + (sc.handoff.outS - sc.handoff.inS)))
        if (inS < 0 || (asset.durationS > 0 && outS > asset.durationS + 0.05) || outS - inS < 1.5) { why('excerpt out of range'); break }
        const surface = s(o.surface, 20)
        const exitStyle = s(o.exitStyle, 20)
        const audioMode = s(o.audioMode, 10)
        const next: DirectorOp = { type: 'footage', sceneIndex: sc.index,
          ...(assetId !== sc.handoff.assetId ? { assetId } : {}),
          ...(Math.abs(inS - sc.handoff.inS) > 0.01 ? { inS: Math.round(inS * 100) / 100 } : {}),
          ...(Math.abs(outS - sc.handoff.outS) > 0.01 ? { outS: Math.round(outS * 100) / 100 } : {}),
          ...((SURFACES as readonly string[]).includes(surface) && surface !== sc.handoff.surface ? { surface } : {}),
          ...((EXIT_STYLES as readonly string[]).includes(exitStyle) && exitStyle !== sc.handoff.exitStyle ? { exitStyle } : {}),
          // narration over the insert forces "bed"; without narration the clip's own sound plays or is muted
          ...(['clip', 'mute'].includes(audioMode) && !sc.lines.length && audioMode !== sc.handoff.audioMode ? { audioMode } : {}) }
        if (Object.keys(next).length <= 2) { why('nothing to change'); break }
        op = next
        break
      }
      case 'music': {
        const anchors: NonNullable<Extract<DirectorOp, { type: 'music' }>['anchors']> = {}
        for (const k of ANCHORS) {
          if (!(k in J(o.anchors))) continue
          const a = J(o.anchors)[k]
          if (a === null) { if (k === 'crash') anchors.crash = null; continue }
          const lid = String(J(a).lineId ?? '')
          const word = s(J(a).word, 40) || null
          const line = bp.scenes.flatMap(x => x.lines).find(l => l.id === lid)
          if (line && (!word || wordInLine(word, line.text))) anchors[k] = { lineId: lid, word }
        }
        const src = s(o.source, 20)
        const source = src === 'generated' || src === 'none' || (src === 'upload' && bp.musicUploadAvailable) ? src : null
        if (!Object.keys(anchors).length && (!source || source === bp.musicSource)) { why('nothing to change'); break }
        op = { type: 'music', ...(Object.keys(anchors).length ? { anchors } : {}), ...(source && source !== bp.musicSource ? { source: source as 'generated' | 'none' | 'upload' } : {}) }
        break
      }
      case 'story': {
        const note = s(o.note, 2000)
        if (!note) { why('empty note'); break }
        op = { type: 'story', note }
        break
      }
      default:
        why('unknown op')
    }
    if (op) items.push({ text, effect: effectOf(op, bp), op })
  }
  return { items, dropped }
}

// ------------------------------------------------------------------------------------------------ effects
export function graphicsIndices(bp: Blueprint): number[] {
  return bp.scenes.filter(x => x.kind === 'graphics').map(x => x.index)
}

export function effectOf(op: DirectorOp, bp: Blueprint): string {
  switch (op.type) {
    case 'scene':
    case 'emphasis':
      return `Re-renders scene ${op.sceneIndex + 1} only`
    case 'footage':
      return `Re-cuts the footage insert in scene ${op.sceneIndex + 1}; other scenes keep their renders`
    case 'world':
      return `Re-renders the ${graphicsIndices(bp).length} graphics scenes (the world changes); footage inserts stay`
    case 'style':
      return op.palette ? `Re-renders all ${bp.scenes.length} scenes (new colours)` : `Re-renders the ${graphicsIndices(bp).length} graphics scenes`
    case 'music':
      return 'Re-mixes the music only; no scene re-renders'
    case 'story':
      return 'Rewrites the script and plan; unchanged scenes reuse their renders'
  }
}

// ------------------------------------------------------------------------------------------------ apply
export type ApplyResult = {
  plan: Json
  rowPlans: Map<number, { plan: Json; visualType?: string }>
  affected: Set<number>
  relayout: boolean
  remix: boolean
  storyNote: string | null
  musicSetting: 'generated' | 'none' | 'upload' | null
}

/** Compose the per-scene notes the scene designer reads (inspector overrides + Director notes). */
export function composeUserNotes(p: Json): string {
  const params = J(p.params)
  return [
    p.styleOverride && `Style: ${p.styleOverride}`,
    p.cameraOverride && `Camera: ${p.cameraOverride}`,
    p.textOverride && `On-screen text: ${p.textOverride}`,
    Object.keys(params).length && `Parameters: ${JSON.stringify(params)}`,
    ...A(p.directorNotes).map(n => `Director note: ${String(n)}`),
  ].filter(Boolean).join('\n')
}

export function applyOps(planIn: unknown, rows: SceneRowLike[], ops: DirectorOp[], bp: Blueprint): ApplyResult {
  const plan: Json = JSON.parse(JSON.stringify(J(planIn)))
  plan.scenes = A(plan.scenes)
  const lay = J(plan.layout)
  const layScenes = A(lay.scenes)
  const rowPlans: ApplyResult['rowPlans'] = new Map()
  const rowPlan = (i: number) => {
    if (!rowPlans.has(i)) rowPlans.set(i, { plan: JSON.parse(JSON.stringify(J(rows.find(r => r.index === i)?.plan))) })
    return rowPlans.get(i)!
  }
  const ps = (i: number): Json => plan.scenes.find((x: Json) => J(x).index === i) ?? {}
  const affected = new Set<number>()
  let relayout = false
  let remix = false
  let musicSetting: ApplyResult['musicSetting'] = null
  const storyNotes: string[] = []
  for (const op of ops) {
    switch (op.type) {
      case 'scene': {
        const p = ps(op.sceneIndex)
        const r = rowPlan(op.sceneIndex)
        if (op.description) { p.description = op.description; r.plan.description = op.description }
        if (op.visualType) {
          p.visualType = op.visualType; r.plan.visualType = op.visualType; r.visualType = op.visualType
          const ls = layScenes.find((x: Json) => J(x).index === op.sceneIndex)
          if (ls) ls.visualType = op.visualType
        }
        if (op.camera) { p.camera = op.camera; r.plan.cameraOverride = op.camera }
        if (op.note) r.plan.directorNotes = [...A(r.plan.directorNotes), op.note].slice(-5)
        r.plan.userNotes = composeUserNotes(r.plan)
        affected.add(op.sceneIndex)
        break
      }
      case 'emphasis': {
        ps(op.sceneIndex).emphasis = op.emphasis
        rowPlan(op.sceneIndex).plan.emphasis = op.emphasis
        affected.add(op.sceneIndex)
        break
      }
      case 'world': {
        plan.world = { ...J(plan.world), type: op.worldType, ...(op.reason ? { reason: op.reason } : {}), changedBy: 'director_chat' }
        graphicsIndices(bp).forEach(i => affected.add(i))
        break
      }
      case 'style': {
        const st = J(plan.style)
        plan.style = { ...st, ...(op.palette ? { palette: { ...J(st.palette), ...op.palette } } : {}),
          ...(op.mood ? { mood: op.mood } : {}), ...(op.grain != null ? { grain: op.grain } : {}),
          ...(op.glow != null ? { glow: op.glow } : {}), ...(op.vignette != null ? { vignette: op.vignette } : {}) }
        ;(op.palette ? bp.scenes.map(x => x.index) : graphicsIndices(bp)).forEach(i => affected.add(i))
        break
      }
      case 'footage': {
        const p = ps(op.sceneIndex)
        const h = { ...J(p.handoff) }
        if (op.assetId) h.assetId = op.assetId
        if (op.inS != null) h.inS = op.inS
        if (op.outS != null) h.outS = op.outS
        if (op.surface) h.surface = op.surface
        if (op.exitStyle) h.exitStyle = op.exitStyle
        if (op.audioMode) h.audioMode = op.audioMode
        p.handoff = h
        const r = rowPlan(op.sceneIndex)
        r.plan.handoff = { ...J(r.plan.handoff), ...h }
        affected.add(op.sceneIndex)
        relayout = true
        break
      }
      case 'music': {
        if (op.anchors) {
          const cur = J(plan.musicAnchors)
          for (const [k, v] of Object.entries(op.anchors)) { if (v === null) delete cur[k]; else cur[k] = v }
          plan.musicAnchors = cur
        }
        if (op.source) {
          plan.musicSource = op.source === 'upload' ? 'user' : op.source
          musicSetting = op.source
        }
        remix = true
        break
      }
      case 'story':
        storyNotes.push(op.note)
        break
    }
  }
  return { plan, rowPlans, affected, relayout, remix, storyNote: storyNotes.length ? storyNotes.join('\n') : null, musicSetting }
}

export function scenesPhrase(indices: number[]): string {
  const n = [...indices].sort((a, b) => a - b).map(i => i + 1)
  if (!n.length) return 'no scenes'
  if (n.length === 1) return `scene ${n[0]}`
  return `scenes ${n.slice(0, -1).join(', ')} and ${n.at(-1)}`
}

import type { FacecamBox } from '@/lib/clips/facecam-geometry'

export type T6Signals = {
  v: number
  clip_type: string
  type_conf: number
  game_ui_visible?: boolean
  real_camera_footage?: boolean
  facecam_box?: FacecamBox | null
  facecam_conf?: number
  person_count?: number
  background_action?: boolean
  moment_kind?: string
  energy?: string
  hud_at_edges?: boolean
  bands?: Record<string, { luma: number; busy: number }>
  sources?: { ai?: string; cv?: string }
  cost_usd?: number
  /** T6.3: recurring YuNet faces (t6_cv.detect_faces); undefined = never measured. */
  faces?: T6Face[]
  /** T6.3: detected game region (aiMeta.facecamLayout.gameplay) — excludes the cam/HUD strip. */
  gameplay_box?: FacecamBox | null
  content_box?: FacecamBox | null
  /** T6.7: the close look's scene map (t6_scenes.py), refined faces per scene. */
  scenes?: T6Scene[]
}

export type T6SceneLayout =
  | 'webcam_game'
  | 'webcam_screen'
  | 'full_cam_person'
  | 'multi_cam'
  | 'irl_world'
  | 'no_person'

export type T6Scene = {
  start_s: number
  end_s: number
  layout: T6SceneLayout
  n_cams?: number
  real_person_boxes?: FacecamBox[]
  facecam_box?: FacecamBox | null
  content_box?: FacecamBox | null
  faces?: T6Face[]
}

export type T6Face = { x: number; y: number; w: number; h: number; persist?: number; score?: number }

function normBox(raw: unknown): FacecamBox | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const c = (v: unknown) => Math.max(0, Math.min(1, Number(v ?? 0) || 0))
  const x = c(r.x)
  const y = c(r.y)
  let w = c(r.w)
  let h = c(r.h)
  if (w <= 0 || h <= 0) return null
  if (x + w > 1.001) w = Math.max(0.01, 1 - x)
  if (y + h > 1.001) h = Math.max(0.01, 1 - y)
  const r4 = (v: number) => Math.round(v * 10000) / 10000
  return { x: r4(x), y: r4(y), w: r4(w), h: r4(h) }
}

/** Parity with t6_signals.signals_or_defaults (gameplay_box from facecamLayout). */
function gameplayBox(stored: T6Signals | undefined, layoutRaw: unknown): FacecamBox | null {
  const s = (stored as { gameplay_box?: unknown } | undefined)?.gameplay_box
  if (s && typeof s === 'object') return s as FacecamBox
  const layout = layoutRaw && typeof layoutRaw === 'object' ? (layoutRaw as Record<string, unknown>) : {}
  if (!normBox(layout.facecam)) return null
  return normBox(layout.gameplay)
}

function validFaces(raw: unknown): T6Face[] | undefined {
  if (!Array.isArray(raw)) return undefined
  return raw.filter(
    (f): f is T6Face =>
      Boolean(f) && typeof f === 'object' && Number((f as T6Face).w) > 0 && Number((f as T6Face).h) > 0,
  )
}

export function signalsOrDefaults(aiMeta: Record<string, unknown> | null | undefined): T6Signals {
  const meta = aiMeta ?? {}
  const stored = meta.signals as T6Signals | undefined
  const clipType = String(meta.clipType ?? stored?.clip_type ?? 'irl')
  return {
    v: 1,
    clip_type: stored?.clip_type ?? clipType,
    type_conf: Number(stored?.type_conf ?? 0),
    game_ui_visible: Boolean(stored?.game_ui_visible ?? false),
    real_camera_footage: Boolean(stored?.real_camera_footage ?? false),
    // T6.3 parity with signals_or_defaults: fall back to the detected facecamLayout.facecam.
    facecam_box:
      stored && 'facecam_box' in stored
        ? ((stored.facecam_box as FacecamBox | null | undefined) ?? null)
        : normBox((meta.facecamLayout as { facecam?: unknown } | undefined)?.facecam),
    facecam_conf: Number(stored?.facecam_conf ?? meta.facecamConfidence ?? 0),
    person_count: Number(stored?.person_count ?? 1),
    background_action: stored?.background_action ?? true,
    moment_kind: stored?.moment_kind ?? 'story',
    energy: stored?.energy ?? 'mid',
    hud_at_edges: stored?.hud_at_edges ?? false,
    bands: stored?.bands ?? {
      top: { luma: 0.3, busy: 0.5 },
      bottom: { luma: 0.3, busy: 0.5 },
      caption: { luma: 0.3, busy: 0.5 },
    },
    sources: stored?.sources ?? { ai: 'none', cv: 'local' },
    cost_usd: Number(stored?.cost_usd ?? 0),
    faces: validFaces((stored as { faces?: unknown } | undefined)?.faces),
    gameplay_box: gameplayBox(stored, meta.facecamLayout),
    content_box: normBox((stored as { content_box?: unknown } | undefined)?.content_box),
    scenes: Array.isArray((stored as { scenes?: unknown } | undefined)?.scenes)
      ? ((stored as { scenes: T6Scene[] }).scenes)
      : undefined,
  }
}

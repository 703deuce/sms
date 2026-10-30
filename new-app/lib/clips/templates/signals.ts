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
    facecam_box: (stored?.facecam_box as FacecamBox | null | undefined) ?? null,
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
  }
}

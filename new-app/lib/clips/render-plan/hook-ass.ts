/** EP1: TS port of worker/clips_worker/hook_overlay._hook_ass (+ hook_motion_events) — byte-identical. */
import { hasMotionPy, layerTransformAtPy, MOTION_FPS, normalizeKeyframes } from '@/lib/clips/render-plan/motion'
import { hex2, pyFloatStr, pyRound, pyRoundN } from '@/lib/clips/render-plan/py'

export const HOOK_FADE_IN_MS = 180
export const HOOK_FADE_OUT_MS = 220

function hexToAss(hex: string, alpha = '00'): string {
  const h = hex.trim().replace(/^#+/, '')
  if (h.length !== 6) return '&H00FFFFFF'
  const [r, g, b] = [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)].map((x) => parseInt(x, 16))
  return `&H${alpha}${hex2(b!)}${hex2(g!)}${hex2(r!)}`
}

function assTs(cs: number): string {
  const h = Math.floor(cs / 360000)
  const m = Math.floor((cs % 360000) / 6000)
  const s = Math.floor((cs % 6000) / 100)
  const c = cs % 100
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`
}

export function hookFadeAt(tMs: number, durationMs: number): number {
  if (tMs < HOOK_FADE_IN_MS) return Math.max(0, tMs / HOOK_FADE_IN_MS)
  if (tMs > durationMs - HOOK_FADE_OUT_MS) return Math.max(0, (durationMs - tMs) / HOOK_FADE_OUT_MS)
  return 1.0
}

/** hook_overlay.apply_hook_overlay inputs → .ass, or null when the hook is off (same gate). */
export function hookAssForEdits(edits: Record<string, unknown>, w: number, h: number): string | null {
  const ho = edits.hookOverlay as Record<string, unknown> | undefined
  if (!ho || typeof ho !== 'object' || !ho.enabled) return null
  const text = String(ho.text || '').trim()
  if (!text) return null
  let dur = Math.trunc(Number(ho.durationMs || 2500))
  dur = Math.max(1500, Math.min(5000, dur))
  const brand = (edits.brand && typeof edits.brand === 'object' ? edits.brand : {}) as Record<string, unknown>
  return buildHookAss(text, dur, { w, h, primaryColor: String(brand.primaryColor || '#FACC15'), motionEdits: edits })
}

export function buildHookAss(
  text: string,
  durationMs: number,
  o: { w: number; h: number; primaryColor: string; font?: string; motionEdits?: Record<string, unknown> | null },
): string {
  const { w, h } = o
  const font = o.font ?? 'DejaVu Sans'
  const primary = hexToAss(o.primaryColor)
  const short = Math.min(w, h)
  const fontsize = pyRound(short * 0.072)
  const marginLr = pyRound(w * 0.08)
  const y = pyRound(h * 0.11)
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${w}
PlayResY: ${h}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Hook,${font},${fontsize},${primary},&H00FFFFFF,&H00000000,&H96000000,1,0,0,0,100,100,0,0,1,4,2,8,${marginLr},${marginLr},40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`
  const endTs = assTs(Math.floor(Math.max(0, durationMs) / 10))
  const esc = text.replace(/\\/g, '\\\\').replace(/\{/g, '(').replace(/\}/g, ')').replace(/\n/g, '\\N')
  const tracks = o.motionEdits ? normalizeKeyframes(o.motionEdits.keyframes) : []
  if (o.motionEdits && hasMotionPy(tracks, 'text')) {
    const out: string[] = []
    const fps = MOTION_FPS
    const frames = Math.trunc(Math.ceil((durationMs * fps) / 1000))
    for (let f = 0; f < frames; f++) {
      const tMs = (f * 1000) / fps
      const startCs = Math.trunc(Math.floor((f * 100) / fps + 1e-9))
      const endCs = Math.min(Math.trunc(Math.floor(((f + 1) * 100) / fps + 1e-9)), Math.floor(Math.max(0, durationMs) / 10))
      if (endCs <= startCs) continue
      const tf = layerTransformAtPy(tracks, 'text', tMs)
      const op = Math.max(0, Math.min(1, (tf.opacity / 100) * hookFadeAt(tMs, durationMs)))
      const a = hex2(pyRound(255 * (1 - op)))
      const shadow = hex2(pyRound(255 - (255 - 0x96) * op))
      const px = pyRound(Math.floor(w / 2) + (tf.x * w) / 100)
      const py = pyRound(y + (tf.y * h) / 100)
      const sc = pyFloatStr(pyRoundN(tf.scale, 2))
      const rot = pyFloatStr(pyRoundN(-tf.rotation, 2))
      out.push(`Dialogue: 3,${assTs(startCs)},${assTs(endCs)},Hook,,0,0,0,,{\\an8\\pos(${px},${py})\\fscx${sc}\\fscy${sc}\\frz${rot}\\1a&H${a}&\\3a&H${a}&\\4a&H${shadow}&}${esc}\n`)
    }
    return header + out.join('')
  }
  return header + `Dialogue: 3,0:00:00.00,${endTs},Hook,,0,0,0,,{\\an8\\pos(${Math.floor(w / 2)},${y})\\fad(180,220)}${esc}` + '\n'
}

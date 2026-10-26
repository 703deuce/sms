import { CAPTION_PRESETS, presetSlugToId, resolvePreset } from '@/lib/clips/caption-presets'
import type { ClipEditsV2 } from '@/lib/clips/edits'

export type ResolvedCaptionStyle = {
  presetId: string
  animation: string
  size: number
}

export function resolvedCaptionStyle(captions: ClipEditsV2['captions'] | undefined): ResolvedCaptionStyle {
  const cap = captions ?? {}
  const preset = resolvePreset(cap.presetId)
  return {
    presetId: cap.presetId?.trim() || 'bold_pop',
    animation: String(cap.animation || preset.animation),
    size: cap.size ?? preset.sizePct,
  }
}

export function captionStylesEqual(before: ClipEditsV2, after: ClipEditsV2): boolean {
  return (
    JSON.stringify(resolvedCaptionStyle(before.captions)) ===
    JSON.stringify(resolvedCaptionStyle(after.captions))
  )
}

/** Map human preset names / slugs to canonical presetId. */
export function normalizeCaptionPresetId(raw: unknown, fallback = 'bold_pop'): string {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!s) return fallback
  if (s === 'bold_pop' || s === 'bold-pop' || s === 'bold pop') return 'bold_pop'
  for (const p of CAPTION_PRESETS) {
    const id = presetSlugToId(p.slug)
    if (id === s || p.slug === s || p.name.toLowerCase() === s) return id
  }
  return s.replace(/-/g, '_')
}

export function normalizeSetCaptionsArgs(
  args: Record<string, unknown>,
  current: ClipEditsV2['captions'] | undefined,
): Record<string, unknown> {
  const out = { ...args }
  if (out.presetId !== undefined) {
    out.presetId = normalizeCaptionPresetId(out.presetId, resolvedCaptionStyle(current).presetId)
  }
  if (out.animation !== undefined) {
    const a = String(out.animation).toLowerCase().trim()
    if (a === 'pop animated' || a === 'pop-animated') out.animation = 'pop'
    else out.animation = a
  }
  return out
}

export function pickAlternateCaptionPreset(currentPresetId: string): { presetId: string; animation: string } {
  const cur = normalizeCaptionPresetId(currentPresetId)
  for (const p of CAPTION_PRESETS) {
    const id = presetSlugToId(p.slug)
    if (id !== cur) return { presetId: id, animation: p.animation }
  }
  return { presetId: 'karaoke', animation: 'karaoke' }
}

/** Strip false "changed captions" claims from the model reply when style is unchanged. */
export function sanitizeProducerCaptionReply(
  reply: string,
  before: ClipEditsV2,
  after: ClipEditsV2,
  hadSetCaptionsTool: boolean,
): string {
  if (!hadSetCaptionsTool || !captionStylesEqual(before, after)) return reply
  const style = resolvedCaptionStyle(before.captions)
  const preset = resolvePreset(style.presetId)
  const label = preset.name
  const anim = style.animation === 'pop' ? 'pop' : style.animation
  const noChange = `Captions are already ${label} with ${anim} animation — no change was needed.`
  const lower = reply.toLowerCase()
  const claimsChange =
    lower.includes('caption') &&
    (lower.includes('updated') ||
      lower.includes('changed') ||
      lower.includes('set to') ||
      lower.includes('switched') ||
      lower.includes('applied'))
  if (claimsChange) return noChange
  if (!reply.trim()) return noChange
  return `${reply.trim()}\n\n(${noChange})`
}

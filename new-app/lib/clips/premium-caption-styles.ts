/**
 * Optional premium caption art direction. The original 14 classic presets stay
 * byte-identical. These styles use their existing ASS engine through presetConfig,
 * not a new renderer or a retroactive migration of saved captions.
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'

export type PremiumCaptionStyle = {
  id: string; name: string; font: string; weight: number; wordsPerLine: number
  sizePct: number; marginVPct: number; primary: string; active: string
  activeB: string; outline: string; outlineW: number; shadow: number
  case: 'upper' | 'sentence'; animation: 'pop' | 'bounce' | 'slideup' | 'typewriter' | 'none'
  position: 'bottom' | 'middle'; emphasisScale: number
}
export const PREMIUM_CAPTION_STYLES: readonly PremiumCaptionStyle[] = [
  { id: 'editorial-serif', name: 'Editorial Serif', font: 'DM Serif Display', weight: 400,
    wordsPerLine: 4, sizePct: 5.4, marginVPct: 13, primary: '#FFFFFF', active: '#FDE68A',
    activeB: '#FDE68A', outline: '#111827', outlineW: 3, shadow: 1, case: 'sentence',
    animation: 'slideup', position: 'bottom', emphasisScale: 1.06 },
  { id: 'studio-clean', name: 'Studio Clean', font: 'Space Grotesk', weight: 400,
    wordsPerLine: 5, sizePct: 4.7, marginVPct: 12, primary: '#FFFFFF', active: '#A7F3D0',
    activeB: '#A7F3D0', outline: '#020617', outlineW: 2, shadow: 1, case: 'sentence',
    animation: 'none', position: 'bottom', emphasisScale: 1 },
  { id: 'comic-sports', name: 'Sports Energy', font: 'Fira Sans Condensed', weight: 700,
    wordsPerLine: 3, sizePct: 7, marginVPct: 16, primary: '#FFFFFF', active: '#FACC15',
    activeB: '#FACC15', outline: '#020617', outlineW: 6, shadow: 0, case: 'upper',
    animation: 'bounce', position: 'bottom', emphasisScale: 1.18 },
  { id: 'creator-notes', name: 'Creator Notes', font: 'Gabarito', weight: 400,
    wordsPerLine: 4, sizePct: 5.7, marginVPct: 14, primary: '#FFFFFF', active: '#67E8F9',
    activeB: '#67E8F9', outline: '#0F172A', outlineW: 4, shadow: 0, case: 'sentence',
    animation: 'typewriter', position: 'bottom', emphasisScale: 1.06 },
  { id: 'quiet-film', name: 'Quiet Film', font: 'Playfair Display', weight: 400,
    wordsPerLine: 5, sizePct: 5.1, marginVPct: 10, primary: '#FFF7ED', active: '#FED7AA',
    activeB: '#FED7AA', outline: '#431407', outlineW: 2, shadow: 1, case: 'sentence',
    animation: 'slideup', position: 'bottom', emphasisScale: 1.02 },
  { id: 'mono-tech', name: 'Mono Tech', font: 'Space Mono', weight: 400,
    wordsPerLine: 3, sizePct: 5.1, marginVPct: 15, primary: '#E2E8F0', active: '#4ADE80',
    activeB: '#4ADE80', outline: '#020617', outlineW: 3, shadow: 0, case: 'sentence',
    animation: 'pop', position: 'bottom', emphasisScale: 1.08 },
  { id: 'friendly', name: 'Friendly', font: 'Rubik', weight: 400,
    wordsPerLine: 4, sizePct: 5.6, marginVPct: 13, primary: '#FFFFFF', active: '#FDE047',
    activeB: '#FDE047', outline: '#18181B', outlineW: 4, shadow: 0, case: 'sentence',
    animation: 'pop', position: 'bottom', emphasisScale: 1.12 },
  { id: 'handwritten', name: 'Handwritten', font: 'Caveat', weight: 400,
    wordsPerLine: 4, sizePct: 7.1, marginVPct: 15, primary: '#FFFFFF', active: '#F9A8D4',
    activeB: '#F9A8D4', outline: '#4A044E', outlineW: 3, shadow: 0, case: 'sentence',
    animation: 'slideup', position: 'bottom', emphasisScale: 1.1 },
] as const

const KEYS = ['typographyPresetId', 'font', 'weight', 'case', 'wordsPerLine', 'sizePct',
  'position', 'marginVPct', 'primary', 'active', 'activeB', 'outline', 'outlineW', 'shadow',
  'animation', 'emphasisScale'] as const
export function clearPremiumCaptionStyle(cap: ClipEditsV2['captions']): ClipEditsV2['captions'] {
  if (!cap.presetConfig?.typographyPresetId) return cap
  const cfg = { ...cap.presetConfig }
  for (const key of KEYS) delete cfg[key]
  return { ...cap, font: undefined, presetConfig: Object.keys(cfg).length ? cfg : undefined }
}
export function applyPremiumCaptionStyle(cap: ClipEditsV2['captions'], id: string): ClipEditsV2['captions'] {
  const style = PREMIUM_CAPTION_STYLES.find(s => s.id === id)
  if (!style) throw new Error('unsupported_premium_caption_style:' + id)
  return {
    ...cap, enabled: cap.enabled !== false, presetId: 'bold_pop',
    customPresetId: undefined, font: style.font, animation: style.animation,
    marginVPct: style.marginVPct, position: style.position,
    userSizePct: undefined,
    presetConfig: { ...(cap.presetConfig ?? {}), ...style, typographyPresetId: style.id },
  }
}

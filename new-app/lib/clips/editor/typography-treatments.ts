/**
 * Opt-in, editable two-layer type treatments for REAL video projects.
 * Existing caption presets, text items, EDL, and exported documents are untouched.
 * A caller must explicitly add the returned items through the established editor commit path.
 */
import type { TextItem } from '@/lib/clips/editor/text-items'
import { normalizeTextItems } from '@/lib/clips/editor/text-items'
import type { TextAnim } from '@/lib/clips/render-plan/text-anim'

export type TypographyTreatment = {
  id: string
  title: string
  headline: TextItem['style']
  subtitle: TextItem['style']
  anim: TextAnim
  headlineY: number
  subtitleY: number
  maxCharacters: number
}
/** All faces in this catalog already exist in the seven-font text/worker allowlist. */
export const TYPOGRAPHY_TREATMENTS: readonly TypographyTreatment[] = [
  {
    id: 'editorial-contrast', title: 'Editorial Contrast',
    headline: { font: 'Bebas Neue', size: 154, color: '#FFFFFF', align: 'center', case: 'upper',
      stroke: { color: '#111827', width: 4 }, letterSpacing: 5 },
    subtitle: { font: 'Poppins', size: 54, color: '#FDE68A', align: 'center', case: 'none',
      box: { color: '#111827', opacity: 80, pad: 12 } },
    anim: { in: { type: 'slide_up', unit: 'block', durMs: 350 }, out: { type: 'fade', unit: 'block', durMs: 240 } },
    headlineY: 38, subtitleY: 51, maxCharacters: 65,
  },
  {
    id: 'kinetic-punch', title: 'Kinetic Punch',
    headline: { font: 'Bangers', size: 145, color: '#FEF08A', align: 'center', case: 'upper',
      stroke: { color: '#020617', width: 9 } },
    subtitle: { font: 'Montserrat', size: 50, color: '#FFFFFF', align: 'center', case: 'upper',
      stroke: { color: '#020617', width: 3 } },
    anim: { in: { type: 'pop', unit: 'word', durMs: 380 }, out: { type: 'zoom_out', unit: 'block', durMs: 280 },
      loop: { type: 'pulse', periodMs: 1700 } },
    headlineY: 36, subtitleY: 50, maxCharacters: 50,
  },
  {
    id: 'minimal-interview', title: 'Minimal Interview',
    headline: { font: 'Archivo Black', size: 84, color: '#FFFFFF', align: 'left', case: 'none',
      shadow: { color: '#000000', opacity: 70, dist: 5 } },
    subtitle: { font: 'Poppins', size: 53, color: '#D1D5DB', align: 'left', case: 'none',
      box: { color: '#111827', opacity: 75, pad: 9 } },
    anim: { in: { type: 'fade', unit: 'line', durMs: 450 }, out: { type: 'fade', unit: 'block', durMs: 280 } },
    headlineY: 75, subtitleY: 84, maxCharacters: 90,
  },
  {
    id: 'neon-signal', title: 'Neon Signal',
    headline: { font: 'Anton', size: 132, color: '#67E8F9', align: 'center', case: 'upper',
      stroke: { color: '#164E63', width: 7 } },
    subtitle: { font: 'Bebas Neue', size: 68, color: '#FFFFFF', align: 'center', case: 'upper',
      letterSpacing: 8 },
    anim: { in: { type: 'rotate_in', unit: 'block', durMs: 440 }, out: { type: 'fade', unit: 'block', durMs: 290 },
      loop: { type: 'flicker', periodMs: 2800 } },
    headlineY: 36, subtitleY: 49, maxCharacters: 60,
  },
  {"id":"serif-documentary","title":"Serif Documentary","headline":{"font":"DM Serif Display","size":120,"color":"#FFFFFF","align":"center","case":"none","stroke":{"color":"#0F172A","width":4}},"subtitle":{"font":"Space Grotesk","size":48,"color":"#E2E8F0","align":"center","case":"none","box":{"color":"#0F172A","opacity":78,"pad":12}},"anim":{"in":{"type":"fade","unit":"line","durMs":500},"out":{"type":"fade","unit":"block","durMs":300}},"headlineY":38,"subtitleY":51,"maxCharacters":80},
  {"id":"data-broadcast","title":"Data Broadcast","headline":{"font":"Space Grotesk","size":114,"color":"#D9F99D","align":"center","case":"upper","stroke":{"color":"#052E16","width":5}},"subtitle":{"font":"Space Mono","size":45,"color":"#FFFFFF","align":"center","case":"none","box":{"color":"#052E16","opacity":84,"pad":10}},"anim":{"in":{"type":"pop","unit":"word","durMs":420},"out":{"type":"slide_right","unit":"block","durMs":320},"loop":{"type":"pulse","periodMs":2100}},"headlineY":38,"subtitleY":50,"maxCharacters":65},
  {"id":"warm-narrative","title":"Warm Narrative","headline":{"font":"Playfair Display","size":115,"color":"#FFF7ED","align":"center","case":"none","stroke":{"color":"#431407","width":4}},"subtitle":{"font":"Caveat","size":76,"color":"#FED7AA","align":"center","case":"none","shadow":{"color":"#431407","opacity":85,"dist":5}},"anim":{"in":{"type":"slide_up","unit":"block","durMs":420},"out":{"type":"fade","unit":"line","durMs":320}},"headlineY":38,"subtitleY":53,"maxCharacters":75},
  {"id":"sport-energy","title":"Sport Energy","headline":{"font":"Fira Sans Condensed","size":144,"color":"#FFFFFF","align":"center","case":"upper","stroke":{"color":"#0F172A","width":7}},"subtitle":{"font":"Rubik","size":52,"color":"#FDE047","align":"center","case":"upper","box":{"color":"#0F172A","opacity":85,"pad":12}},"anim":{"in":{"type":"bounce_in","unit":"block","durMs":450},"out":{"type":"zoom_out","unit":"block","durMs":300},"loop":{"type":"wiggle","periodMs":2900}},"headlineY":37,"subtitleY":52,"maxCharacters":68},
  {"id":"creator-notes","title":"Creator Notes","headline":{"font":"Gabarito","size":118,"color":"#FFFFFF","align":"left","case":"none","stroke":{"color":"#1E293B","width":5}},"subtitle":{"font":"Space Mono","size":45,"color":"#A7F3D0","align":"left","case":"none","box":{"color":"#064E3B","opacity":86,"pad":9}},"anim":{"in":{"type":"typewriter","unit":"char","durMs":750},"out":{"type":"fade","unit":"block","durMs":280}},"headlineY":37,"subtitleY":51,"maxCharacters":78},
] as const

const ID = /^[a-zA-Z0-9_-]{1,36}$/
export function createTypographyTreatment(input: {
  id: string; headline: string; subtitle: string; startMs: number; endMs: number;
  treatmentId: string; aspectRatio: '9:16' | '1:1' | '16:9'
}): TextItem[] {
  const treatment = TYPOGRAPHY_TREATMENTS.find(p => p.id === input.treatmentId)
  if (!treatment || !ID.test(input.id)) throw new Error('invalid_typography_treatment')
  if (![input.startMs, input.endMs].every(Number.isSafeInteger) ||
      input.startMs < 0 || input.endMs - input.startMs < 800)
    throw new Error('invalid_typography_interval')
  if (!input.headline.trim() || !input.subtitle.trim() ||
      Array.from(input.headline).length > treatment.maxCharacters ||
      Array.from(input.subtitle).length > 160)
    throw new Error('invalid_typography_content')
  // Keep text within platform-safe vertical margin; the editor retains full control.
  const horizontalMargin = input.aspectRatio === '9:16' ? 8 : 6
  const x = treatment.headline.align === 'left' ? horizontalMargin : 50
  const make = (suffix: string, text: string, y: number, style: TextItem['style']): TextItem => ({
    id: `type_${input.id}_${suffix}`, text: text.trim(),
    startMs: input.startMs, endMs: input.endMs, x, y, style: { ...style },
    anim: { ...treatment.anim },
  })
  const items = [make('h', input.headline, treatment.headlineY, treatment.headline),
    make('s', input.subtitle, treatment.subtitleY, treatment.subtitle)]
  const validated = normalizeTextItems(items, input.endMs)
  if (!validated || validated.length !== 2) throw new Error('invalid_typography_layer')
  return validated
}

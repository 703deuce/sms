/**
 * E4 Templates (CapCut "Templates" picker). Built FROM what the repo already has — nothing moves:
 *
 *   Layouts        21 T6 layout templates (template-registry.json: G1–G6, I1–I6, C1–C9) when T6 is on,
 *                  else the 8 export layout options (layout-options.ts) — the Layout ▾ / Polish pickers
 *   Caption styles 10 classic presets (caption-presets.ts) + 11 CP presets v2 (cp1–cp11, T6 flag)
 *   Text styles    4 T6 title styles (title-styles.json) as text presets + 8 E4 text presets
 *   Brand kits     workspace brand templates (DB clipBrandTemplate; applyBrandTemplateToEdits)
 *   Starter looks  NEW, on top: one tap = layout + caption style + title text + color look
 *                  (+ the workspace default brand kit's intro / outro when it has them)
 *
 * Every apply is a pure edits → edits function, so the editor commits it as ONE undo step.
 */
import { CAPTION_PRESETS, presetSlugToId } from '@/lib/clips/caption-presets'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { normalizeColorSpec, setVideoLook, type ColorPresetId } from '@/lib/clips/editor/color'
import { newTextItem, TEXT_PRESETS } from '@/lib/clips/editor/text-items'
import { CAPTION_PRESETS_V2, T6_TEMPLATES_BY_ID, templateInFamily, type TemplateDef, type TemplateLane } from '@/lib/clips/templates/registry'

/**
 * Same patch the Layout panel's template tiles apply (template-layout-panel.tsx applyTemplate),
 * shared so both pickers produce identical edits.
 */
export function templateLayoutPatch(
  edits: ClipEditsV2,
  t: TemplateDef,
  opts: { auto: boolean; reason?: string; family?: string },
): ClipEditsV2 {
  const famLane = (opts.family && templateInFamily(t, opts.family) ? opts.family : t.lane) as TemplateLane
  const usesTrim = t.panels.some((p) => p.src === 'trim_sides' || p.src === 'action_box')
  const fallback =
    t.lane === 'irl' && /^I[1-4]$/.test(t.id) ? 'fit_blur' : (t.fallbackMode as ClipEditsV2['layout']['mode'])
  return {
    ...edits,
    layout: {
      ...edits.layout,
      mode: fallback,
      cropBox: usesTrim ? edits.layout.cropBox : undefined,
      layoutSegments: undefined,
      userPicked: !opts.auto,
      template: { id: t.id, auto: opts.auto, reason: opts.reason, lane: famLane, boxes: edits.layout.template?.boxes },
    },
  }
}

export type CaptionStyleOption = { id: string; name: string; kind: 'classic' | 'cp'; font: string }

/** Existing caption styles, classic first (always available), then CP v2 (T6 flag). */
export function captionStyleOptions(includeCp: boolean): CaptionStyleOption[] {
  const classic = CAPTION_PRESETS.map((p) => ({ id: presetSlugToId(p.slug), name: p.name, kind: 'classic' as const, font: p.font }))
  if (!includeCp) return classic
  const cp = Object.entries(CAPTION_PRESETS_V2)
    .filter(([id, p]) => id.startsWith('cp') && !(p as { deferred?: boolean }).deferred)
    .map(([id, p]) => ({ id, name: String((p as { name?: string }).name ?? id), kind: 'cp' as const, font: String((p as { font?: string }).font ?? '') }))
  return [...classic, ...cp]
}

/** Same patches the Captions panel applies (captions-panel.tsx: classic grid / CP grid). */
export function captionPresetPatch(edits: ClipEditsV2, id: string): ClipEditsV2 {
  const cap = edits.captions
  if (id.startsWith('cp')) {
    return {
      ...edits,
      captions: { enabled: cap.enabled !== false, presetId: id, emphasis: cap.emphasis, size: cap.size, position: cap.position } as ClipEditsV2['captions'],
    }
  }
  const p = CAPTION_PRESETS.find((x) => presetSlugToId(x.slug) === id)
  if (!p) return edits
  return {
    ...edits,
    captions: { ...cap, enabled: cap.enabled !== false, presetId: id, animation: p.animation, size: cap.size ?? p.sizePct } as ClipEditsV2['captions'],
  }
}

export type StarterLook = {
  id: string
  name: string
  /** T6 layout template (used when T6 templates are on) … */
  layoutTemplate: string
  /** … else this export layout mode. */
  layoutMode: ClipEditsV2['layout']['mode']
  /** CP preset when T6 captions are on, else the classic fallback. */
  caption: string
  captionFallback: string
  textPreset: string
  color?: ColorPresetId
}

export const STARTER_LOOKS: StarterLook[] = [
  { id: 'gaming_hype', name: 'Gaming hype', layoutTemplate: 'G1', layoutMode: 'facecam_stack', caption: 'cp2', captionFallback: 'bounce', textPreset: 'comic', color: 'vivid' },
  { id: 'podcast_clean', name: 'Podcast clean', layoutTemplate: 'C7', layoutMode: 'split', caption: 'cp5', captionFallback: 'clean_white', textPreset: 'title_white_on_black' },
  { id: 'irl_vlog', name: 'IRL vlog', layoutTemplate: 'I3', layoutMode: 'fit_blur', caption: 'cp10', captionFallback: 'minimal', textPreset: 'shadow_soft', color: 'warm' },
  { id: 'chat_punch', name: 'Chatting punch', layoutTemplate: 'C2', layoutMode: 'speaker_follow', caption: 'cp1', captionFallback: 'bold_pop', textPreset: 'outline_yellow', color: 'vivid' },
  { id: 'cinematic', name: 'Cinematic', layoutTemplate: 'I1', layoutMode: 'fit_blur', caption: 'cp9', captionFallback: 'minimal', textPreset: 'tall_clean', color: 'teal_orange' },
  { id: 'retro', name: 'Retro', layoutTemplate: 'C1', layoutMode: 'speaker_follow', caption: 'cp7', captionFallback: 'typewriter', textPreset: 'label_red', color: 'vintage' },
  { id: 'neon_gamer', name: 'Neon gamer', layoutTemplate: 'G3', layoutMode: 'facecam_pip', caption: 'cp13', captionFallback: 'neon', textPreset: 'comic', color: 'vivid' },
  { id: 'news_desk', name: 'News desk', layoutTemplate: 'C4', layoutMode: 'fit_top', caption: 'cp15', captionFallback: 'lower_third', textPreset: 'label_red' },
  { id: 'edu_explainer', name: 'Explainer', layoutTemplate: 'C6', layoutMode: 'screen_pip', caption: 'cp16', captionFallback: 'clean_white', textPreset: 'title_white_on_black' },
  { id: 'hype_reel', name: 'Hype reel', layoutTemplate: 'I5', layoutMode: 'speaker_follow', caption: 'cp17', captionFallback: 'heavy_outline', textPreset: 'outline_yellow', color: 'vivid' },
  { id: 'soft_story', name: 'Soft story', layoutTemplate: 'I2', layoutMode: 'fit_blur', caption: 'cp18', captionFallback: 'minimal', textPreset: 'shadow_soft', color: 'warm' },
  { id: 'emoji_chat', name: 'Emoji chat', layoutTemplate: 'C3', layoutMode: 'speaker_follow', caption: 'cp14', captionFallback: 'word_pop', textPreset: 'outline_yellow' },
]

export type StarterApplyOpts = {
  t6Templates: boolean
  t6Captions: boolean
  durationMs: number
  newId: () => string
  /** Workspace default brand kit applied on top (intro / outro, logo) — optional. */
  applyBrand?: (e: ClipEditsV2) => ClipEditsV2
}

/** One starter look → one edits change (one undo step). Replaces a previous starter title. */
export function applyStarterLook(edits: ClipEditsV2, look: StarterLook, opts: StarterApplyOpts): ClipEditsV2 {
  let next = edits
  const tpl = T6_TEMPLATES_BY_ID[look.layoutTemplate]
  if (opts.t6Templates && tpl) next = templateLayoutPatch(next, tpl, { auto: false, reason: `starter:${look.id}`, family: tpl.lane })
  else next = { ...next, layout: { ...next.layout, mode: look.layoutMode, userPicked: true } }
  next = captionPresetPatch(next, opts.t6Captions ? look.caption : look.captionFallback)
  const title = (edits.hookOverlay?.text ?? '').trim() || 'Your title'
  const preset = TEXT_PRESETS.find((p) => p.id === look.textPreset)
  if (preset) {
    const item = { ...newTextItem(opts.newId(), 0, Math.max(1000, opts.durationMs), preset.id, title), y: 14, presetId: `starter:${look.id}` }
    item.endMs = Math.min(Math.max(1000, opts.durationMs), 3000)
    const kept = (next.textItems ?? []).filter((t) => !t.presetId?.startsWith('starter:'))
    next = { ...next, textItems: [...kept, item] }
  }
  next = { ...next, color: setVideoLook(next.color, look.color ? normalizeColorSpec({ preset: look.color }) ?? null : null) }
  if (opts.applyBrand) next = opts.applyBrand(next)
  return next
}

/** Counts for the spec inventory / picker headers. */
export function templateInventory(t6Templates: boolean, t6Captions: boolean) {
  return {
    layouts: t6Templates ? Object.keys(T6_TEMPLATES_BY_ID).length : 8,
    captionStyles: captionStyleOptions(t6Captions).length,
    textStyles: TEXT_PRESETS.length,
    starters: STARTER_LOOKS.length,
  }
}

import type { ClipEditsV2 } from '@/lib/clips/edits'
import { defaultLayoutSegments } from '@/lib/clips/layout-segments'
import { headlineStyleForPreset } from '@/lib/clips/overlay-geometry'
import {
  legacyFromLayers,
  type Layer,
  type TemplateV3,
  layersFromLegacy,
  resolveLayers,
  templateV3Schema,
} from '@/lib/clips/layers'

export function templateFromEdits(edits: ClipEditsV2, name?: string): TemplateV3 {
  const layers = layersFromLegacy(edits)
  return templateV3Schema.parse({
    v: 3,
    name,
    layout: { mode: edits.layout?.mode ?? 'speaker_follow' },
    layers,
  })
}

/** Apply a v3 brand template onto clip edits (stores layersV + legacy mirror). */
export function applyTemplateV3ToEdits(edits: ClipEditsV2, template: TemplateV3): ClipEditsV2 {
  const parsed = templateV3Schema.parse(template)
  const layoutMode = (parsed.layout?.mode ||
    edits.layout?.mode ||
    'speaker_follow') as ClipEditsV2['layout']['mode']
  const current = resolveLayers(edits)
  const headlineText = current.find((l) => l.id === 'headline' && l.type === 'headline')
  const layers = (parsed.layers as Layer[]).map((layer) => {
    if (layer.id === 'headline' && layer.type === 'headline' && headlineText?.type === 'headline') {
      return {
        ...layer,
        text: headlineText.text,
        suggested: headlineText.suggested ?? layer.suggested,
      }
    }
    return layer
  })
  const merged = legacyFromLayers(layers, {
    ...edits,
    layout: { ...edits.layout, mode: layoutMode },
  })
  return {
    ...merged,
    layersV: 3,
    layers,
  }
}

/** Built-in “Auto” preset — not stored as a brand template row. */
export function applyAutoTemplateToEdits(
  edits: ClipEditsV2,
  opts: {
    streamerSide?: { login?: string; platform?: string } | null
    defaultLayoutMode?: ClipEditsV2['layout']['mode']
    platform?: 'twitch' | 'kick'
  },
): ClipEditsV2 {
  const isStreamer = opts.streamerSide?.platform === 'twitch' || opts.streamerSide?.platform === 'kick'
  const platform =
    opts.platform ??
    (opts.streamerSide?.platform === 'kick'
      ? 'kick'
      : opts.streamerSide?.platform === 'twitch'
        ? 'twitch'
        : 'twitch')
  const layoutMode: ClipEditsV2['layout']['mode'] = isStreamer
    ? 'fit_top'
    : (opts.defaultLayoutMode ?? edits.layout?.mode ?? 'speaker_follow')
  const current = resolveLayers(edits)
  const headline = current.find((l) => l.id === 'headline' && l.type === 'headline')
  const headlineText =
    headline?.type === 'headline' ? headline.text : edits.exportTemplate?.headlineBar?.text ?? ''
  const yellow = headlineStyleForPreset('stream_yellow')
  const barStyle = headlineStyleForPreset('export_bar')
  const layers: Layer[] = current.map((layer) => {
    if (layer.type === 'sticker' && layer.kind === 'follow_cta') {
      return { ...layer, enabled: false }
    }
    if (layer.id === 'badge' && layer.type === 'badge') {
      if (isStreamer) {
        const handle = (opts.streamerSide?.login ?? '').replace(/^@/, '') || 'channel'
        return {
          ...layer,
          enabled: true,
          platform,
          handle,
          showLogo: true,
          showLabel: true,
          showLink: false,
        }
      }
      return { ...layer, enabled: false, showLogo: false, showLabel: false, showLink: false }
    }
    if (layer.id === 'headline' && layer.type === 'headline') {
      if (isStreamer) {
        return {
          ...layer,
          enabled: true,
          text: headlineText,
          style: { preset: 'stream_yellow', ...yellow },
          placement: 'export_bar',
        }
      }
      return {
        ...layer,
        enabled: Boolean(headlineText?.trim()),
        text: headlineText,
        style: { preset: 'export_bar', ...barStyle },
        placement: 'export_bar',
      }
    }
    return layer
  })
  const merged = legacyFromLayers(layers, {
    ...edits,
    layout: {
      ...edits.layout,
      mode: layoutMode,
      layoutSegments: defaultLayoutSegments(edits.trim.in, edits.trim.out, layoutMode),
    },
  })
  return { ...merged, layersV: 3, layers }
}

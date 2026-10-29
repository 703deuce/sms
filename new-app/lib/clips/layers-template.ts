import type { ClipEditsV2 } from '@/lib/clips/edits'
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

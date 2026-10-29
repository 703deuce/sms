import type { ClipEditsV2 } from '@/lib/clips/edits'
import {
  legacyFromLayers,
  mappedEditsSubset,
  type Layer,
  type TemplateV3,
  legacyLayersFingerprint,
  layersFromLegacy,
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
  const merged = legacyFromLayers(parsed.layers as Layer[], {
    ...edits,
    layout: { ...edits.layout, mode: layoutMode },
  })
  const fp = legacyLayersFingerprint(mappedEditsSubset(merged))
  return {
    ...merged,
    layersV: 3,
    layers: parsed.layers,
    layersLegacyFp: fp,
  }
}

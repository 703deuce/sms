/**
 * UI-only placeholders for model gallery art and short blurbs.
 * The v1 contract has no thumbnailUrl or description; do not send these
 * fields to the API. Asked for on PR #1135.
 */
import type { StudioMediaKind, StudioMode, StudioModel } from './contract'

export type StudioModelVisual = {
  /** CSS gradient, not a remote asset. */
  art: string
  /** Short local blurb until the registry ships a description. */
  blurb: string
}

const ART: Record<string, StudioModelVisual> = {
  'veo-3.1-lite': {
    art: 'linear-gradient(135deg, #1e3a5f 0%, #0f766e 52%, #134e4a 100%)',
    blurb: 'Fast Veo 3.1 for everyday clips. Text or image to video, with start and end frames.',
  },
  'veo-3.1-fast': {
    art: 'linear-gradient(135deg, #1e1b4b 0%, #3730a3 50%, #0e7490 100%)',
    blurb: 'Snappier Veo 3.1 when you want a quicker turnaround at a higher credit estimate.',
  },
  'veo-3.1-quality': {
    art: 'linear-gradient(135deg, #3b0764 0%, #6b21a8 45%, #9f1239 100%)',
    blurb: 'Highest Veo 3.1 estimate in this registry. Use when the shot needs more fidelity.',
  },
  'hailuo-2.3': {
    art: 'linear-gradient(135deg, #3f3f46 0%, #44403c 40%, #b45309 100%)',
    blurb: 'Image-to-video only. Start from a reference still.',
  },
  'seedance-2.0-mini': {
    art: 'linear-gradient(135deg, #0c4a6e 0%, #155e75 40%, #57534e 100%)',
    blurb: 'Default test model. Shortest durations and a lower placeholder credit estimate.',
  },
  'flux-2-pro': {
    art: 'linear-gradient(145deg, #44403c 0%, #292524 45%, #ca8a04 100%)',
    blurb: 'Default image model. Text to image at 1K or 2K.',
  },
  'nano-banana': {
    art: 'linear-gradient(135deg, #365314 0%, #3f6212 50%, #a16207 100%)',
    blurb: 'Lightweight text-to-image with an optional reference still.',
  },
  'nano-banana-pro': {
    art: 'linear-gradient(135deg, #14532d 0%, #166534 50%, #854d0e 100%)',
    blurb: 'Higher-resolution Nano Banana, up to 4K in this registry.',
  },
}

const FALLBACK_ART = {
  video: 'linear-gradient(135deg, #1f2937 0%, #334155 60%, #0f172a 100%)',
  image: 'linear-gradient(135deg, #292524 0%, #44403c 55%, #1c1917 100%)',
}

export function modelVisual(model: Pick<StudioModel, 'id' | 'kind'>): StudioModelVisual {
  return (
    ART[model.id] ?? {
      art: FALLBACK_ART[model.kind],
      blurb: model.kind === 'video' ? 'Video generation model from the studio registry.' : 'Image generation model from the studio registry.',
    }
  )
}

export type PromptPreset = { id: string; label: string; prompt: string }

export const PROMPT_PRESETS: Record<StudioMode, PromptPreset[]> = {
  text_to_video: [
    { id: 't2v-street', label: 'Night street', prompt: 'A quiet city street at night after rain, neon reflections on wet asphalt, slow dolly forward, cinematic lighting.' },
    { id: 't2v-portrait', label: 'Portrait', prompt: 'Close-up of a person turning toward the camera in soft window light, subtle hair movement, shallow depth of field.' },
    { id: 't2v-nature', label: 'Forest', prompt: 'Sunlight filtering through a dense forest, particles in the air, gentle camera push through ferns, natural sound-stage stillness.' },
  ],
  image_to_video: [
    { id: 'i2v-breathe', label: 'Bring to life', prompt: 'Animate the reference gently: natural motion, consistent identity, camera locked off, realistic lighting.' },
    { id: 'i2v-pan', label: 'Slow pan', prompt: 'Slow cinematic pan across the reference, keep composition and style, no morphing, steady motion.' },
    { id: 'i2v-wind', label: 'Wind', prompt: 'Add subtle wind and fabric or foliage movement to the reference, preserve faces and typography.' },
  ],
  text_to_image: [
    { id: 't2i-product', label: 'Product', prompt: 'Studio product still on a matte charcoal surface, soft rim light, sharp detail, editorial look.' },
    { id: 't2i-key', label: 'Key art', prompt: 'Cinematic key art of a lone figure on a rooftop at dusk, dramatic sky, anamorphic still, rich color.' },
    { id: 't2i-logo', label: 'Texture', prompt: 'Abstract brushed-metal texture with a faint geometric mark, premium, no typography.' },
  ],
  source_video_edit: [],
}

export type StudioCategoryId = StudioMode

export function categoriesFromModels(models: StudioModel[]): { kind: StudioMediaKind; modes: StudioMode[] }[] {
  const videoModes: StudioMode[] = []
  const imageModes: StudioMode[] = []
  for (const m of models) {
    for (const mode of m.modes) {
      if (mode === 'text_to_image') {
        if (!imageModes.includes(mode)) imageModes.push(mode)
      } else if (!videoModes.includes(mode)) {
        videoModes.push(mode)
      }
    }
  }
  const groups: { kind: StudioMediaKind; modes: StudioMode[] }[] = []
  if (videoModes.length) groups.push({ kind: 'video', modes: videoModes })
  if (imageModes.length) groups.push({ kind: 'image', modes: imageModes })
  return groups
}

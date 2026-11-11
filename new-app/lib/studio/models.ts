import { StudioError } from './errors'
import type {
  KieCreateRequest,
  StudioAspect,
  StudioCreateJobInput,
  StudioMediaKind,
  StudioMode,
  StudioModelPublic,
  StudioRegistryDocument,
} from './types'
import { STUDIO_REGISTRY_VERSION } from './types'

export type StudioModelConfig = StudioModelPublic & {
  providerModel: string
  providerApi: 'jobs' | 'veo'
  defaultAspect: StudioAspect
  defaultDurationSec: number | null
  defaultResolution: string | null
  /** Maps a contract resolution to the provider spelling. */
  resolveResolution?: (value: string) => string | null
  requiresStartOrReference?: boolean
}

const ASPECTS_ALL: StudioAspect[] = ['9:16', '16:9', '1:1']
const ASPECTS_VEO: StudioAspect[] = ['9:16', '16:9']
const ASPECTS_PHOTO_AD: StudioAspect[] = ['9:16', '16:9', '1:1', '3:4']

function aliasResolution(map: Record<string, string>) {
  return (value: string): string | null => {
    const key = value.trim()
    if (map[key]) return map[key]
    const lower = key.toLowerCase()
    for (const [from, to] of Object.entries(map)) {
      if (from.toLowerCase() === lower) return to
    }
    return null
  }
}

/**
 * Launch registry. Adding or removing a model is one entry.
 * Frontend uses `id`; provider keys stay server-side.
 */
export const STUDIO_MODELS: StudioModelConfig[] = [
  {
    id: 'veo-3.1-lite',
    label: 'Veo 3.1 Lite',
    kind: 'video',
    modes: ['text_to_video', 'image_to_video'],
    supportsStartEndFrame: true,
    supportsReferenceImage: true,
    aspects: ASPECTS_VEO,
    durationsSec: [4, 6, 8],
    resolutions: ['720p', '1080p', '4k'],
    creditEstimate: 20,
    providerModel: 'veo3_lite',
    providerApi: 'veo',
    defaultAspect: '16:9',
    defaultDurationSec: 4,
    defaultResolution: '720p',
    resolveResolution: aliasResolution({ '720p': '720p', '1080p': '1080p', '4k': '4k', '4K': '4k' }),
  },
  {
    id: 'veo-3.1-fast',
    label: 'Veo 3.1 Fast',
    kind: 'video',
    modes: ['text_to_video', 'image_to_video'],
    supportsStartEndFrame: true,
    supportsReferenceImage: true,
    aspects: ASPECTS_VEO,
    durationsSec: [4, 6, 8],
    resolutions: ['720p', '1080p', '4k'],
    creditEstimate: 30,
    providerModel: 'veo3_fast',
    providerApi: 'veo',
    defaultAspect: '16:9',
    defaultDurationSec: 4,
    defaultResolution: '720p',
    resolveResolution: aliasResolution({ '720p': '720p', '1080p': '1080p', '4k': '4k', '4K': '4k' }),
  },
  {
    id: 'veo-3.1-quality',
    label: 'Veo 3.1 Quality',
    kind: 'video',
    modes: ['text_to_video', 'image_to_video'],
    supportsStartEndFrame: true,
    supportsReferenceImage: true,
    aspects: ASPECTS_VEO,
    durationsSec: [4, 6, 8],
    resolutions: ['720p', '1080p', '4k'],
    creditEstimate: 50,
    providerModel: 'veo3',
    providerApi: 'veo',
    defaultAspect: '16:9',
    defaultDurationSec: 4,
    defaultResolution: '720p',
    resolveResolution: aliasResolution({ '720p': '720p', '1080p': '1080p', '4k': '4k', '4K': '4k' }),
  },
  {
    id: 'hailuo-2.3',
    label: 'Hailuo 2.3',
    kind: 'video',
    modes: ['image_to_video'],
    supportsStartEndFrame: false,
    supportsReferenceImage: true,
    aspects: ASPECTS_ALL,
    durationsSec: [6, 10],
    resolutions: ['768P', '1080P'],
    creditEstimate: 12,
    providerModel: 'hailuo/2-3-image-to-video-standard',
    providerApi: 'jobs',
    defaultAspect: '16:9',
    defaultDurationSec: 6,
    defaultResolution: '768P',
    requiresStartOrReference: true,
    resolveResolution: aliasResolution({
      '768P': '768P',
      '768p': '768P',
      '720p': '768P',
      '1080P': '1080P',
      '1080p': '1080P',
    }),
  },
  {
    id: 'wan-3.0',
    label: 'Wan 3.0',
    kind: 'video',
    modes: ['text_to_video', 'image_to_video'],
    supportsStartEndFrame: true,
    supportsReferenceImage: true,
    aspects: ASPECTS_PHOTO_AD,
    durationsSec: [2, 4, 5, 6, 8, 10, 12, 15, 20, 30],
    resolutions: ['480P', '720P', '1080P'],
    creditEstimate: 0,
    providerModel: 'wan/3-0-video',
    providerApi: 'jobs',
    defaultAspect: '16:9',
    defaultDurationSec: 15,
    defaultResolution: '720P',
    resolveResolution: aliasResolution({ '480P': '480P', '480p': '480P', '720P': '720P', '720p': '720P', '1080P': '1080P', '1080p': '1080P' }),
  },
  {
    id: 'seedance-2.5',
    label: 'Seedance 2.5',
    kind: 'video',
    modes: ['text_to_video', 'image_to_video'],
    supportsStartEndFrame: true,
    supportsReferenceImage: true,
    aspects: ASPECTS_PHOTO_AD,
    durationsSec: [4, 5, 6, 8, 10, 12, 15, 20, 30],
    resolutions: ['480p', '720p', '1080p'],
    creditEstimate: 0,
    providerModel: 'bytedance/seedance-2-5',
    providerApi: 'jobs',
    defaultAspect: '16:9',
    defaultDurationSec: 15,
    defaultResolution: '720p',
    resolveResolution: aliasResolution({ '480p': '480p', '720p': '720p', '1080p': '1080p' }),
  },
  {
    id: 'seedance-2.0-mini',
    label: 'Seedance 2.0 Mini',
    kind: 'video',
    modes: ['text_to_video', 'image_to_video'],
    supportsStartEndFrame: true,
    supportsReferenceImage: true,
    aspects: ASPECTS_ALL,
    durationsSec: [4, 5, 6, 8, 10, 12, 15],
    resolutions: ['480p', '720p'],
    creditEstimate: 8,
    providerModel: 'bytedance/seedance-2-mini',
    providerApi: 'jobs',
    defaultAspect: '16:9',
    defaultDurationSec: 4,
    defaultResolution: '480p',
    resolveResolution: aliasResolution({ '480p': '480p', '720p': '720p' }),
  },
  {
    id: 'wan-2.7-video-edit',
    label: 'Wan 2.7 Video Edit',
    kind: 'video',
    modes: ['source_video_edit'],
    supportsStartEndFrame: false,
    supportsReferenceImage: true,
    aspects: ASPECTS_ALL,
    durationsSec: [2, 3, 4, 5, 6, 7, 8, 9, 10],
    resolutions: ['720p', '1080p'],
    creditEstimate: 32,
    sourceVideoEdit: {
      minDurationSec: 2,
      maxDurationSec: 10,
      creditPerSecondByResolution: { '720p': 16, '1080p': 24 },
    },
    providerModel: 'wan/2-7-videoedit',
    providerApi: 'jobs',
    defaultAspect: '16:9',
    defaultDurationSec: 2,
    defaultResolution: '720p',
    resolveResolution: aliasResolution({ '720p': '720p', '1080p': '1080p' }),
  },
  {
    id: 'flux-2-pro',
    label: 'Flux 2 Pro',
    kind: 'image',
    modes: ['text_to_image'],
    supportsStartEndFrame: false,
    supportsReferenceImage: false,
    aspects: ASPECTS_ALL,
    durationsSec: [],
    resolutions: ['1K', '2K'],
    creditEstimate: 5,
    providerModel: 'flux-2/pro-text-to-image',
    providerApi: 'jobs',
    defaultAspect: '1:1',
    defaultDurationSec: null,
    defaultResolution: '1K',
    resolveResolution: aliasResolution({ '1K': '1K', '1k': '1K', '2K': '2K', '2k': '2K' }),
  },
  {
    id: 'nano-banana',
    label: 'Nano Banana',
    kind: 'image',
    modes: ['text_to_image'],
    supportsStartEndFrame: false,
    supportsReferenceImage: true,
    aspects: ASPECTS_ALL,
    durationsSec: [],
    resolutions: [],
    creditEstimate: 4,
    providerModel: 'google/nano-banana',
    providerApi: 'jobs',
    defaultAspect: '1:1',
    defaultDurationSec: null,
    defaultResolution: null,
  },
  {
    id: 'nano-banana-pro',
    label: 'Nano Banana Pro',
    kind: 'image',
    modes: ['text_to_image'],
    supportsStartEndFrame: false,
    supportsReferenceImage: true,
    aspects: ASPECTS_PHOTO_AD,
    durationsSec: [],
    resolutions: ['1K', '2K', '4K'],
    creditEstimate: 8,
    providerModel: 'nano-banana-pro',
    providerApi: 'jobs',
    defaultAspect: '1:1',
    defaultDurationSec: null,
    defaultResolution: '1K',
    resolveResolution: aliasResolution({ '1K': '1K', '1k': '1K', '2K': '2K', '2k': '2K', '4K': '4K', '4k': '4K' }),
  },
]

const BY_ID = new Map(STUDIO_MODELS.map((m) => [m.id, m]))

export function getStudioModel(id: string): StudioModelConfig | undefined {
  return BY_ID.get(id)
}

export function publicStudioModel(model: StudioModelConfig): StudioModelPublic {
  const {
    providerModel: _providerModel,
    providerApi: _providerApi,
    defaultAspect: _defaultAspect,
    defaultDurationSec: _defaultDurationSec,
    defaultResolution: _defaultResolution,
    resolveResolution: _resolveResolution,
    requiresStartOrReference: _requiresStartOrReference,
    ...pub
  } = model
  void _providerModel
  void _providerApi
  void _defaultAspect
  void _defaultDurationSec
  void _defaultResolution
  void _resolveResolution
  void _requiresStartOrReference
  return pub
}

export function getStudioRegistryDocument(opts?: { mode?: StudioMode }): StudioRegistryDocument {
  const models = opts?.mode
    ? STUDIO_MODELS.filter((model) => model.modes.includes(opts.mode!))
    : STUDIO_MODELS.filter((model) => !model.modes.includes('source_video_edit'))
  return {
    version: STUDIO_REGISTRY_VERSION,
    models: models.map(publicStudioModel),
  }
}

export type ResolvedStudioCreate = {
  model: StudioModelConfig
  mode: StudioMode
  prompt: string
  aspect: StudioAspect
  durationSec: number | null
  resolution: string | null
  referenceAssetId: string | null
  referenceAssetIds: string[]
  startFrameAssetId: string | null
  endFrameAssetId: string | null
  sourceVideoAssetId: string | null
  creditEstimate: number
  projectId: string | null
  nativeAudio: boolean
}

function requirePrompt(raw: string | undefined): string {
  const prompt = (raw ?? '').trim()
  if (prompt.length < 3) throw new StudioError('INVALID_PARAMS', 'Prompt must be at least 3 characters')
  if (prompt.length > 20000) throw new StudioError('INVALID_PARAMS', 'Prompt is too long')
  return prompt
}

export function resolveStudioCreateInput(input: StudioCreateJobInput): ResolvedStudioCreate {
  const modelId = (input.modelId ?? '').trim()
  if (!modelId) throw new StudioError('INVALID_PARAMS', 'modelId is required')
  const model = getStudioModel(modelId)
  if (!model) throw new StudioError('UNKNOWN_MODEL', 'Unknown or disabled model')

  const mode = input.mode
  if (!model.modes.includes(mode)) {
    throw new StudioError('INVALID_PARAMS', `Mode ${mode} is not supported by ${model.id}`)
  }

  const prompt = requirePrompt(input.prompt)
  if (mode === 'source_video_edit' && prompt.length > 5000) {
    throw new StudioError('INVALID_PARAMS', 'Video edit prompt must be 5000 characters or fewer')
  }

  let aspect: StudioAspect = input.aspect ?? model.defaultAspect
  if (input.aspect && !model.aspects.includes(input.aspect)) {
    throw new StudioError('INVALID_PARAMS', `Aspect ${input.aspect} is not supported by ${model.id}`)
  }

  let durationSec: number | null = null
  if (model.kind === 'video') {
    durationSec = input.durationSec ?? model.defaultDurationSec
    if (durationSec == null || !model.durationsSec.includes(durationSec)) {
      throw new StudioError('INVALID_PARAMS', `Duration is not supported by ${model.id}`)
    }
  } else if (input.durationSec != null) {
    throw new StudioError('INVALID_PARAMS', 'durationSec is not used for image models')
  }

  let resolution: string | null = model.defaultResolution
  if (model.resolutions.length) {
    const raw = input.resolution ?? model.defaultResolution
    if (!raw) throw new StudioError('INVALID_PARAMS', 'resolution is required')
    const resolved = model.resolveResolution ? model.resolveResolution(raw) : model.resolutions.includes(raw) ? raw : null
    if (!resolved) throw new StudioError('INVALID_PARAMS', `Resolution is not supported by ${model.id}`)
    resolution = resolved
  } else if (input.resolution) {
    throw new StudioError('INVALID_PARAMS', `Resolution is not used by ${model.id}`)
  }

  const referenceAssetIds = [...new Set((input.referenceAssetIds ?? []).map((value) => value.trim()).filter(Boolean))]
  if (referenceAssetIds.length > 8) throw new StudioError('INVALID_PARAMS', 'At most 8 reference images are supported')
  const referenceAssetId = input.referenceAssetId?.trim() || referenceAssetIds[0] || null
  if (referenceAssetId && !referenceAssetIds.includes(referenceAssetId)) referenceAssetIds.unshift(referenceAssetId)
  const startFrameAssetId = input.startFrameAssetId?.trim() || null
  const endFrameAssetId = input.endFrameAssetId?.trim() || null
  const sourceVideoAssetId = input.sourceVideoAssetId?.trim() || null

  if (mode === 'source_video_edit' && !sourceVideoAssetId) {
    throw new StudioError('INVALID_PARAMS', 'source_video_edit requires sourceVideoAssetId')
  }
  if (mode !== 'source_video_edit' && sourceVideoAssetId) {
    throw new StudioError('INVALID_PARAMS', 'sourceVideoAssetId is only valid for source_video_edit')
  }

  if (endFrameAssetId && !model.supportsStartEndFrame) {
    throw new StudioError('INVALID_PARAMS', `${model.id} does not support start/end frames`)
  }
  if ((startFrameAssetId || endFrameAssetId) && !model.supportsStartEndFrame && !model.requiresStartOrReference) {
    throw new StudioError('INVALID_PARAMS', `${model.id} does not support start/end frames`)
  }
  if (referenceAssetId && !model.supportsReferenceImage) {
    throw new StudioError('INVALID_PARAMS', `${model.id} does not support a reference image`)
  }
  if (mode === 'image_to_video' && !startFrameAssetId && !referenceAssetId) {
    throw new StudioError('INVALID_PARAMS', 'image_to_video requires startFrameAssetId or referenceAssetId')
  }
  if (model.requiresStartOrReference && !startFrameAssetId && !referenceAssetId) {
    throw new StudioError('INVALID_PARAMS', `${model.id} requires a start frame or reference image`)
  }
  if (endFrameAssetId && !startFrameAssetId && !referenceAssetId) {
    throw new StudioError('INVALID_PARAMS', 'endFrameAssetId requires a start frame')
  }

  const rate = mode === 'source_video_edit' && durationSec != null && resolution
    ? model.sourceVideoEdit?.creditPerSecondByResolution[resolution]
    : undefined
  const creditEstimate = rate ? Math.round(rate * durationSec) : model.creditEstimate

  return {
    model,
    mode,
    prompt,
    aspect,
    durationSec,
    resolution,
    referenceAssetId,
    referenceAssetIds,
    startFrameAssetId,
    endFrameAssetId,
    sourceVideoAssetId,
    creditEstimate,
    projectId: input.projectId?.trim() || null,
    nativeAudio: input.nativeAudio === true,
  }
}

export type StudioAssetUrls = {
  sourceVideoUrl?: string
  referenceUrl?: string
  referenceUrls?: string[]
  startFrameUrl?: string
  endFrameUrl?: string
}

export function buildKieCreateRequest(resolved: ResolvedStudioCreate, urls: StudioAssetUrls): KieCreateRequest {
  const { model, prompt, aspect, durationSec, resolution, mode } = resolved
  const startUrl = urls.startFrameUrl || urls.referenceUrl
  const endUrl = urls.endFrameUrl
  const referenceUrl = urls.referenceUrl
  const referenceUrls = urls.referenceUrls?.length ? urls.referenceUrls : referenceUrl ? [referenceUrl] : []

  if (model.providerApi === 'veo') {
    const body: Record<string, unknown> = {
      prompt,
      model: model.providerModel,
      aspectRatio: aspect === '1:1' ? '16:9' : aspect,
      resolution: resolution || '720p',
      duration: durationSec ?? 4,
    }
    const imageUrls: string[] = []
    if (mode === 'image_to_video' || startUrl || endUrl) {
      if (startUrl) imageUrls.push(startUrl)
      if (endUrl) imageUrls.push(endUrl)
    } else if (referenceUrl) {
      imageUrls.push(referenceUrl)
    }
    if (imageUrls.length) body.imageUrls = imageUrls
    return { api: 'veo', model: model.providerModel, input: body }
  }

  if (model.id === 'wan-2.7-video-edit') {
    if (!urls.sourceVideoUrl) throw new StudioError('INVALID_PARAMS', 'Wan 2.7 Video Edit requires source video')
    const input: Record<string, unknown> = {
      prompt,
      video_url: urls.sourceVideoUrl,
      resolution: resolution || '720p',
      duration: durationSec ?? 0,
      audio_setting: 'origin',
      prompt_extend: true,
      watermark: false,
      nsfw_checker: false,
    }
    if (referenceUrl) input.reference_image = referenceUrl
    return { api: 'jobs', model: model.providerModel, input }
  }

  if (model.id === 'wan-3.0') {
    const input: Record<string, unknown> = {
      prompt,
      aspect_ratio: aspect,
      duration: durationSec ?? 15,
      resolution: resolution || '720P',
      audio: true,
      nsfw_checker: false,
    }
    if (mode === 'image_to_video') {
      if (!startUrl) throw new StudioError('INVALID_PARAMS', 'Wan 3.0 image-to-video requires a first frame')
      input.first_frame_url = startUrl
    }
    if (endUrl) input.last_frame_url = endUrl
    return { api: 'jobs', model: model.providerModel, input }
  }

  if (model.id === 'seedance-2.5') {
    const input: Record<string, unknown> = {
      prompt,
      aspect_ratio: aspect,
      duration: durationSec ?? 15,
      resolution: resolution || '720p',
      generate_audio: true,
      output_format: 'mp4',
      nsfw_checker: false,
    }
    if (mode === 'image_to_video') {
      if (!startUrl) throw new StudioError('INVALID_PARAMS', 'Seedance 2.5 image-to-video requires a first frame')
      input.first_frame_url = startUrl
    } else if (referenceUrl) {
      input.reference_image_urls = [referenceUrl]
    }
    if (endUrl) input.last_frame_url = endUrl
    return { api: 'jobs', model: model.providerModel, input }
  }

  if (model.id === 'seedance-2.0-mini') {
    const input: Record<string, unknown> = {
      prompt,
      aspect_ratio: aspect,
      duration: durationSec ?? 4,
      resolution: resolution || '480p',
      generate_audio: resolved.nativeAudio,
    }
    // Seedance treats first/last-frame conditioning and reference_image_urls as mutually exclusive.
    // For image-to-video, a lone reference image is the actual first frame; previously startUrl
    // aliased referenceUrl and both branches were skipped, so KIE received no product image at all.
    if (urls.startFrameUrl) input.first_frame_url = urls.startFrameUrl
    else if (mode === 'image_to_video' && referenceUrl) input.first_frame_url = referenceUrl
    else if (referenceUrl) input.reference_image_urls = [referenceUrl]
    if (endUrl) input.last_frame_url = endUrl
    console.info('[studio:kie] seedance_reference_mode', {
      mode,
      hasFirstFrame: Boolean(input.first_frame_url),
      hasLastFrame: Boolean(input.last_frame_url),
      referenceImageCount: Array.isArray(input.reference_image_urls) ? input.reference_image_urls.length : 0,
    })
    return { api: 'jobs', model: model.providerModel, input }
  }

  if (model.id === 'hailuo-2.3') {
    if (!startUrl) throw new StudioError('INVALID_PARAMS', 'hailuo-2.3 requires a start frame or reference image')
    return {
      api: 'jobs',
      model: model.providerModel,
      input: {
        prompt,
        image_url: startUrl,
        duration: String(durationSec ?? 6),
        resolution: resolution || '768P',
      },
    }
  }

  if (model.id === 'flux-2-pro') {
    return {
      api: 'jobs',
      model: model.providerModel,
      input: {
        prompt,
        aspect_ratio: aspect,
        resolution: resolution || '1K',
      },
    }
  }

  if (model.id === 'nano-banana') {
    const input: Record<string, unknown> = {
      prompt,
      aspect_ratio: aspect,
      output_format: 'png',
    }
    if (referenceUrl) input.image_urls = [referenceUrl]
    return { api: 'jobs', model: model.providerModel, input }
  }

  if (model.id === 'nano-banana-pro') {
    const input: Record<string, unknown> = {
      prompt,
      aspect_ratio: aspect,
      resolution: resolution || '1K',
      output_format: 'png',
    }
    if (referenceUrls.length) input.image_input = referenceUrls.slice(0, 8)
    return { api: 'jobs', model: model.providerModel, input }
  }

  throw new StudioError('UNKNOWN_MODEL', 'Unknown or disabled model')
}

export function outputKindForModel(kind: StudioMediaKind): StudioMediaKind {
  return kind
}

export function contentTypeForKind(kind: StudioMediaKind, hint?: string | null): string {
  if (hint && hint.includes('/')) return hint
  return kind === 'video' ? 'video/mp4' : 'image/png'
}

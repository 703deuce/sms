/**
 * Batch 7 F05 depth capability truth table.
 *
 * Do not advertise ordinary-photo "true depth" until a licensed deterministic
 * static-photo cutout/depth + hole-fill pipeline has preview/export proof.
 * The existing RVM path is video person matting on Modal and is not that proof.
 */
export const BATCH7_DEPTH_CAPABILITIES = {
  ordinaryPhotoTrueDepth: {
    status: 'unsupported_hidden',
    defaultEligible: false,
    fallbackChoices: ['photo_frame', 'collage_card', 'before_after'],
    reason: 'No proven licensed local static-photo depth + hole-fill pipeline exists in the repo.',
  },
  suppliedAlphaForeground: {
    status: 'unsupported_current_renderer',
    defaultEligible: false,
    fallbackChoices: ['photo_frame', 'collage_card'],
    reason: 'Existing upload-still B-roll is rendered through opaque yuv420p unless an explicit mask/key creates alpha, so a raw alpha PNG is not a faithful foreground layer.',
  },
  suppliedLayeredParallax: {
    status: 'unsupported_current_renderer',
    defaultEligible: false,
    fallbackChoices: ['photo_frame', 'collage_card', 'before_after'],
    reason: 'The current still-image overlay path does not preserve supplied PNG alpha; layered parallax therefore lacks preview/export occlusion parity.',
  },
  existingVideoMatte: {
    status: 'not_f05_static_depth',
    defaultEligible: false,
    model: 'Robust Video Matting mobilenetv3/resnet50 + optional torchvision person semantic',
    revision: '53d74c6826735f01f4406b5ca9075eee27bec094',
    license: 'GPL-3.0 (vendored notice/license)',
    compute: 'existing Modal Matter GPU path; 20s chunks, 1080 short side, 3600s max, budget guarded',
  },
} as const

export type DepthCrop = { x: number; y: number; width: number; height: number }

const SAFE = /^[A-Za-z0-9_-]{1,120}$/
function fnv(parts: readonly string[]) {
  const s = parts.map((part) => part.length + ':' + part).join('|')
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0).toString(36)
}
function cropKey(crop: DepthCrop) {
  const values = [crop.x, crop.y, crop.width, crop.height]
  if (!values.every(Number.isFinite) || crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0 ||
      crop.x + crop.width > 1 || crop.y + crop.height > 1) throw new Error('invalid_crop')
  return values.map((n) => Math.round(n * 10000) / 10000).join(',')
}

/**
 * Workspace-scoped deterministic key shape reserved for a future licensed
 * derived-depth implementation. Including source/model/revision/crop means a
 * source or crop change invalidates only that source's future derivation.
 */
export function depthDerivedCacheKey(input: {
  workspaceId: string
  sourceAssetId: string
  model: string
  revision: string
  crop: DepthCrop
}) {
  for (const value of [input.workspaceId, input.sourceAssetId, input.model, input.revision])
    if (!SAFE.test(value)) throw new Error('invalid_cache_identity')
  return 'b7depth_' + fnv([
    input.workspaceId, input.sourceAssetId, input.model, input.revision, cropKey(input.crop),
  ])
}

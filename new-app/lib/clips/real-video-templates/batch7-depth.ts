/**
 * Batch 7 F05 depth capability truth table.
 *
 * Do not advertise ordinary-photo "true depth" until a licensed deterministic
 * static-photo cutout/depth + hole-fill pipeline has preview/export proof.
 * The existing RVM path is video person matting on Modal and is not that proof.
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'

export const BATCH7_DEPTH_CAPABILITIES = {
  ordinaryPhotoTrueDepth: {
    status: 'unsupported_hidden',
    defaultEligible: false,
    reason: 'No proven licensed local static-photo depth + hole-fill pipeline exists in the repo.',
  },
  suppliedAlphaForeground: {
    status: 'supported_composite_only',
    defaultEligible: false,
    reason: 'A supplied alpha foreground can be composited, but alpha alone is not true depth or a hole-filled background.',
  },
  suppliedLayeredParallax: {
    status: 'proof_required',
    defaultEligible: false,
    reason: 'Requires both a user-supplied hole-filled background plate and alpha foreground; decoded preview/export parity is still required before F05 release.',
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
export type SuppliedLayerParallaxRequest = {
  id: string
  workspaceId: string
  sourceAssetId: string
  backgroundPlateUploadId: string
  foregroundAlphaUploadId: string
  startMs: number
  endMs: number
  crop: DepthCrop
  reducedMotion?: boolean
}
export type SuppliedLayerParallaxPlan =
  | { ok: true; edits: ClipEditsV2; cacheKey: string; releaseReady: false; proofRequired: true }
  | { ok: false; code: string; detail: string }

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
 * Workspace-scoped deterministic key shape for future derived assets.
 * Includes source, model/revision and crop so replacing one source invalidates
 * only that source's derivation.
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

/**
 * Editable supplied-layer proof plan. This is deliberately NOT release-ready F05:
 * it requires a user-supplied hole-filled background plate plus alpha foreground.
 * Both remain ordinary upload B-roll layers with editable item-local keyframes.
 */
export function planSuppliedLayerParallax(
  edits: ClipEditsV2,
  request: SuppliedLayerParallaxRequest,
): SuppliedLayerParallaxPlan {
  if (!SAFE.test(request.id) || !SAFE.test(request.workspaceId) || !SAFE.test(request.sourceAssetId) ||
      !SAFE.test(request.backgroundPlateUploadId) || !SAFE.test(request.foregroundAlphaUploadId))
    return { ok: false, code: 'invalid_identity', detail: 'Supplied-layer IDs must be safe workspace asset IDs' }
  if (!Number.isFinite(request.startMs) || !Number.isFinite(request.endMs) ||
      request.startMs < 0 || request.endMs - request.startMs < 1000)
    return { ok: false, code: 'invalid_window', detail: 'Supplied-layer parallax needs a >=1s output window' }
  try { cropKey(request.crop) } catch {
    return { ok: false, code: 'invalid_crop', detail: 'Crop must fit normalized source bounds' }
  }
  const bgId = 'b7depth_' + request.id + '_bg'
  const fgId = 'b7depth_' + request.id + '_fg'
  const occupied = new Set((edits.broll ?? []).map((item) => item.id))
  if (occupied.has(bgId) || occupied.has(fgId))
    return { ok: false, code: 'id_collision', detail: 'Depth layer ID already exists' }

  const broll = [
    ...(edits.broll ?? []),
    { id: bgId, source: 'upload' as const, uploadId: request.backgroundPlateUploadId, still: true as const,
      startMs: Math.round(request.startMs), endMs: Math.round(request.endMs), placement: 'manual' as const },
    { id: fgId, source: 'upload' as const, uploadId: request.foregroundAlphaUploadId, still: true as const,
      startMs: Math.round(request.startMs), endMs: Math.round(request.endMs), placement: 'manual' as const },
  ]
  const span = Math.max(1, Math.round(request.endMs - request.startMs) - 1)
  const keyframes = [...(edits.keyframes ?? [])]
  if (!request.reducedMotion) {
    keyframes.push(
      { target: 'broll:' + bgId, prop: 'x', points: [{ tMs: 0, v: -1, ease: 'inOut' }, { tMs: span, v: 1 }] },
      { target: 'broll:' + bgId, prop: 'scale', points: [{ tMs: 0, v: 102, ease: 'inOut' }, { tMs: span, v: 104 }] },
      { target: 'broll:' + fgId, prop: 'x', points: [{ tMs: 0, v: 1, ease: 'inOut' }, { tMs: span, v: -1 }] },
      { target: 'broll:' + fgId, prop: 'scale', points: [{ tMs: 0, v: 106, ease: 'inOut' }, { tMs: span, v: 110 }] },
    )
  }
  return {
    ok: true,
    edits: { ...edits, broll, keyframes },
    cacheKey: depthDerivedCacheKey({
      workspaceId: request.workspaceId,
      sourceAssetId: request.sourceAssetId,
      model: 'supplied_layers',
      revision: 'v1',
      crop: request.crop,
    }),
    releaseReady: false,
    proofRequired: true,
  }
}

import { type ExportDeliver, isDefaultDeliver, stableDeliverJson } from '@/lib/clips/export-deliver'

/** Material hashed into `editsVersionHash` on clip_renders (keep enqueueRenderClip in sync). */
export function clipRenderHashMaterial(
  editsHash: string,
  opts?: { composeSpec?: unknown; deliver?: ExportDeliver | null },
): string {
  let material = opts?.composeSpec != null ? `${editsHash}:${JSON.stringify(opts.composeSpec)}` : editsHash
  const stemsRequested = Boolean(opts?.deliver?.stems)
  material += `:stems=${stemsRequested ? '1' : '0'}`
  if (opts?.deliver && !isDefaultDeliver(opts.deliver)) {
    material += `:${stableDeliverJson(opts.deliver)}`
  }
  return material
}

import 'server-only'
import { z } from 'zod'
import { getPrisma } from '@/lib/server/db'
import { createAdRun } from '@/lib/server/ad-studio/service'
import { createDefaultStudioService } from '@/lib/studio/runtime'
import { getStudioJobForOutput } from '@/lib/studio/jobs'
import { adCommercialReferenceId } from '@/lib/ad-studio/commercial'
import { adKeySchema } from '@/lib/ad-studio/validate'
import { adInvalid } from '@/lib/ad-studio/errors'
import type { AdProductInput } from '@/lib/ad-studio/types'

const commercialBody = z.object({
  variantId: z.string().trim().min(1).max(160),
  idempotencyKey: adKeySchema,
  voiceId: z.string().trim().min(1).max(160).optional(),
  voiceoverEnabled: z.boolean().optional(),
}).strict()

/** Turn an already-completed KIE image ad into a new plan-confirm commercial. */
export async function createCommercialFromImageAd(workspaceId: string, sourceRunId: string, body: unknown) {
  console.info('[ad-studio:b3] commercial_create_begin', { sourceRunId })
  const parsed = commercialBody.safeParse(body)
  if (!parsed.success) throw adInvalid('Choose a completed image ad and an idempotency key.')
  const db = getPrisma()
  const parent = await db.adStudioRun.findFirst({ where: { id: sourceRunId, workspaceId } })
  if (!parent) throw adInvalid('Source ad run was not found.')
  const variant = await db.adStudioImageVariant.findFirst({
    where: { id: parsed.data.variantId, runId: parent.id, status: 'ready' },
  })
  if (!variant?.studioJobId) throw adInvalid('The chosen image ad has not finished generating.')
  const svc = createDefaultStudioService()
  const job = await getStudioJobForOutput(svc, workspaceId, variant.studioJobId)
  if (job.outputKind !== 'image' || !job.outputContentType?.startsWith('image/') || !job.outputStorageKey)
    throw adInvalid('A completed image-ad output is required.')
  const referenceAssetId = adCommercialReferenceId(parent.id, variant.id)
  await db.aiStudioAsset.upsert({
    where: { id: referenceAssetId },
    create: { id: referenceAssetId, workspaceId, userId: parent.userId,
      storageKey: job.outputStorageKey, storageDriver: job.outputStorageDriver,
      contentType: job.outputContentType, kind: 'image' },
    update: {},
  })
  console.info('[ad-studio:b3] commercial_reference_registered', {
    sourceRunId, variantId: variant.id, studioJobId: job.id, assetId: referenceAssetId,
  })
  const source = parent.input as unknown as AdProductInput
  const input: AdProductInput = { ...source, imageAssetIds: [referenceAssetId],
    imageVariantId: variant.id, voiceoverEnabled: parsed.data.voiceoverEnabled ?? false,
    ...(parsed.data.voiceId ? { voiceId: parsed.data.voiceId } : {}) }
  const result = await createAdRun(workspaceId, parent.userId, {
    mode: 'image_ad_to_commercial', input, idempotencyKey: parsed.data.idempotencyKey,
  })
  console.info('[ad-studio:b3] commercial_plan_complete', { sourceRunId, runId: result.run.id, status: result.run.status })
  return result
}

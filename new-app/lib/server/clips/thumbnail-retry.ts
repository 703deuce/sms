import 'server-only'

import { createHmac } from 'node:crypto'
import {
  buildNanoBananaTaskBody,
  createKieImageTask,
} from '@/lib/server/ai/kie-image'
import type { PrismaClient, AiGeneration } from '@prisma/client'

/** REGRESSION_BATCH1 §2b: retry a failed THUMBNAIL variant once (no extra billing). */
export async function retryFailedThumbnailGeneration(
  prisma: PrismaClient,
  gen: AiGeneration,
): Promise<boolean> {
  if (gen.kind !== 'THUMBNAIL' || gen.status === 'READY') return false
  const params = (gen.params && typeof gen.params === 'object' ? gen.params : {}) as Record<string, unknown>
  if (params.autoRetried) return false
  const imageUrl = typeof params.imageRefUrl === 'string' ? params.imageRefUrl : ''
  const aspect = params.aspect === '16:9' ? '16:9' : '9:16'
  if (!imageUrl || !gen.prompt?.trim()) return false

  const appUrl = process.env.APP_URL?.trim().replace(/\/$/, '')
  if (!appUrl) return false

  const secret = process.env.KIE_CALLBACK_SECRET?.trim()
  if (!secret) return false

  const sig = createHmac('sha256', secret).update(gen.id).digest('hex')
  const callback = `${appUrl}/api/clips/kie/callback?g=${encodeURIComponent(gen.id)}&s=${sig}`

  try {
    const taskId = await createKieImageTask(
      buildNanoBananaTaskBody({
        prompt: gen.prompt,
        imageUrls: [imageUrl],
        aspectRatio: aspect,
        callBackUrl: callback,
      }),
    )
    await prisma.aiGeneration.update({
      where: { id: gen.id },
      data: {
        status: 'RUNNING',
        providerTaskId: taskId,
        error: null,
        params: { ...params, autoRetried: true },
      },
    })
    return true
  } catch (err) {
    console.warn('[thumbnail-retry]', {
      generationId: gen.id,
      error: err instanceof Error ? err.message : String(err),
    })
    return false
  }
}

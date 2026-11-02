import { NextResponse } from 'next/server'
import { Decimal } from '@prisma/client/runtime/library'
import {
  fetchKieTask,
  kieVideoCostUsd,
  parseResultVideoUrl,
  verifyGenerationCallback,
} from '@/lib/server/ai/kie'
import { KIE_IMAGE_COST_USD_2K, parseResultImageUrl } from '@/lib/server/ai/kie-image'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { mp4BufferToJpegPoster } from '@/lib/server/clips/kie-poster'
import { retryFailedThumbnailGeneration } from '@/lib/server/clips/thumbnail-retry'
import { getClipStorage } from '@/lib/storage'

export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const generationId = url.searchParams.get('g') || ''
    const sig = url.searchParams.get('s') || ''
    if (!generationId || !verifyGenerationCallback(generationId, sig)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await request.json().catch(() => ({}))

    const prisma = getPrisma()
    const gen = await prisma.aiGeneration.findUnique({ where: { id: generationId } })
    if (!gen?.providerTaskId) return NextResponse.json({ ok: true })

    const record = await fetchKieTask(gen.providerTaskId)
    const state = record.state?.toLowerCase()

    if (state === 'fail') {
      if (gen.kind === 'THUMBNAIL') {
        const retried = await retryFailedThumbnailGeneration(prisma, gen)
        if (retried) return NextResponse.json({ ok: true })
      }
      await prisma.aiGeneration.update({
        where: { id: gen.id },
        data: { status: 'FAILED', error: record.failMsg || record.failCode || 'KIE failed' },
      })
      return NextResponse.json({ ok: true })
    }

    if (state !== 'success') return NextResponse.json({ ok: true })

    const isThumb = gen.kind === 'THUMBNAIL'
    const mediaUrl = isThumb ? parseResultImageUrl(record.resultJson) : parseResultVideoUrl(record.resultJson)
    const res = await fetch(mediaUrl)
    if (!res.ok) throw new Error('Failed to download KIE media')

    const params = (gen.params || {}) as { durationS?: number; resolution?: '480p' | '720p' }
    const durationS = Number(params.durationS || 4)
    const resolution = params.resolution === '720p' ? '720p' : '480p'
    const storageKey = isThumb
      ? `ws/${gen.workspaceId}/clips/${gen.clipId || 'none'}/thumbnails/${gen.id}.png`
      : `ws/${gen.workspaceId}/clips/${gen.clipId || 'none'}/gen/${gen.id}.mp4`

    const buf = Buffer.from(await res.arrayBuffer())
    // E6fix: write through the configured clip storage driver (B2/S3 in prod). This used to upload
    // straight to Supabase Storage while every reader signed against getClipStorage() → covers 404.
    const storage = getClipStorage()
    let posterKey: string | undefined
    if (!isThumb && gen.kind === 'BROLL_VIDEO') {
      try {
        const jpg = await mp4BufferToJpegPoster(buf)
        const key = `ws/${gen.workspaceId}/clips/${gen.clipId || 'none'}/gen/${gen.id}.jpg`
        await storage.putBytes(key, jpg, 'image/jpeg')
        posterKey = key
      } catch {
        posterKey = undefined
      }
    }
    await storage.putBytes(storageKey, buf, isThumb ? 'image/png' : 'video/mp4')

    const nextParams = { ...(params as Record<string, unknown>), ...(posterKey ? { posterKey } : {}) }
    await prisma.aiGeneration.update({
      where: { id: gen.id },
      data: {
        status: 'READY',
        storageKey,
        params: nextParams,
        costUsd: new Decimal(isThumb ? KIE_IMAGE_COST_USD_2K : kieVideoCostUsd(durationS, resolution)),
        error: null,
      },
    })

    if (isThumb) {
      await prisma.clipThumbnail.updateMany({
        where: { generationId: gen.id },
        data: { imageKey: storageKey },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return jsonError(err, 500)
  }
}

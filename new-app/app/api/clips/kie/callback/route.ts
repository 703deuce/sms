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
    const { getSupabaseStorageConfig } = await import('@/lib/storage/supabase-driver')
    const cfg = getSupabaseStorageConfig()
    if (!cfg) throw new Error('storage not configured')
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(cfg.url, cfg.key, { auth: { persistSession: false } })
    const { error } = await supabase.storage.from(cfg.bucket).upload(storageKey, buf, {
      contentType: isThumb ? 'image/png' : 'video/mp4',
      upsert: true,
    })
    if (error) throw new Error(error.message)

    await prisma.aiGeneration.update({
      where: { id: gen.id },
      data: {
        status: 'READY',
        storageKey,
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

import { NextResponse } from 'next/server'
import { fetchKieTask, kieVideoCostUsd, parseResultVideoUrl } from '@/lib/server/ai/kie'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { Decimal } from '@prisma/client/runtime/library'

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const prisma = getPrisma()
    const gen = await prisma.aiGeneration.findFirst({ where: { id, workspaceId } })
    if (!gen) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (
      gen.status === 'RUNNING' &&
      gen.providerTaskId &&
      Date.now() - gen.createdAt.getTime() > 60_000
    ) {
      try {
        const record = await fetchKieTask(gen.providerTaskId)
        const state = record.state?.toLowerCase()
        if (state === 'fail') {
          await prisma.aiGeneration.update({
            where: { id: gen.id },
            data: { status: 'FAILED', error: record.failMsg || 'KIE failed' },
          })
        } else if (state === 'success' && !gen.storageKey) {
          const videoUrl = parseResultVideoUrl(record.resultJson)
          const res = await fetch(videoUrl)
          if (res.ok) {
            const params = (gen.params || {}) as { durationS?: number; resolution?: '480p' | '720p' }
            const durationS = Number(params.durationS || 4)
            const resolution = params.resolution === '720p' ? '720p' : '480p'
            const storageKey = `ws/${gen.workspaceId}/clips/${gen.clipId || 'none'}/gen/${gen.id}.mp4`
            const buf = Buffer.from(await res.arrayBuffer())
            const storage = getClipStorage()
            const cfg = await import('@/lib/storage/supabase-driver').then((m) => m.getSupabaseStorageConfig())
            if (cfg) {
              const { createClient } = await import('@supabase/supabase-js')
              const supabase = createClient(cfg.url, cfg.key, { auth: { persistSession: false } })
              await supabase.storage.from(cfg.bucket).upload(storageKey, buf, {
                contentType: 'video/mp4',
                upsert: true,
              })
              await prisma.aiGeneration.update({
                where: { id: gen.id },
                data: {
                  status: 'READY',
                  storageKey,
                  costUsd: new Decimal(kieVideoCostUsd(durationS, resolution)),
                },
              })
            }
          }
        }
      } catch {
        /* poll best-effort */
      }
    }

    const fresh = await prisma.aiGeneration.findUnique({ where: { id } })
    const storage = getClipStorage()
    const downloadUrl =
      fresh?.storageKey ? await storage.createSignedDownloadUrl(fresh.storageKey, 3600) : null

    return NextResponse.json({
      data: {
        id: fresh?.id,
        status: fresh?.status,
        error: fresh?.error,
        downloadUrl,
        costUsd: fresh?.costUsd ? Number(fresh.costUsd) : null,
        params: fresh?.params,
      },
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}

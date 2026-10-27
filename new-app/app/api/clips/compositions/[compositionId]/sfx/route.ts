import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { presetPrompt, sfxCostUsd } from '@/lib/clips/audio'
import { generateSfx } from '@/lib/server/ai/elevenlabs'
import { recordAiUsage } from '@/lib/server/clips/ai-usage'
import { jsonError } from '@/lib/server/api-error'
import { getCompositionAudioContext } from '@/lib/server/clips/composition-audio'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { createId } from '@/lib/supabase/id'
import { Decimal } from '@prisma/client/runtime/library'

const bodySchema = z.object({
  presetId: z.string().optional(),
  prompt: z.string().optional(),
  durationSec: z.number().min(0.5).max(5).optional().default(2),
})

function promptHash(workspaceId: string, prompt: string) {
  return createHash('sha1').update(`${workspaceId}:${prompt}`).digest('hex')
}

export async function POST(request: Request, ctx: { params: Promise<{ compositionId: string }> }) {
  try {
    const { compositionId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const ctxAudio = await getCompositionAudioContext(workspaceId, compositionId)
    if (!ctxAudio) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = bodySchema.parse(await request.json())
    const prompt =
      (body.presetId ? presetPrompt(body.presetId) : null) || body.prompt?.trim() || ''
    if (prompt.length < 4) {
      return NextResponse.json({ error: 'prompt or presetId required' }, { status: 400 })
    }

    const prisma = getPrisma()
    const hash = promptHash(workspaceId, prompt)
    const cached = await prisma.sfxCache.findUnique({
      where: { workspaceId_promptHash: { workspaceId, promptHash: hash } },
    })
    if (cached) {
      const gen = await prisma.aiGeneration.findFirst({ where: { id: cached.generationId, workspaceId } })
      return NextResponse.json({
        data: {
          generationId: cached.generationId,
          status: gen?.status || 'READY',
          cached: true,
          estimatedCostUsd: 0,
        },
      })
    }

    const clipId = ctxAudio.clipId ?? `composition:${compositionId}`
    const genId = createId('gen')
    const storageKey = `ws/${workspaceId}/clips/${clipId}/sfx/${genId}.mp3`
    await prisma.aiGeneration.create({
      data: {
        id: genId,
        workspaceId,
        clipId: ctxAudio.clipId ?? undefined,
        kind: 'SFX',
        status: 'RUNNING',
        provider: 'elevenlabs',
        prompt,
        params: { durationSec: body.durationSec, presetId: body.presetId || null, compositionId },
      },
    })

    const { result, usage } = await generateSfx({ text: prompt, durationSec: body.durationSec })
    const storage = getClipStorage()
    const cfg = await import('@/lib/storage/supabase-driver').then((m) => m.getSupabaseStorageConfig())
    if (!cfg) throw new Error('Storage not configured')
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(cfg.url, cfg.key, { auth: { persistSession: false } })
    await supabase.storage.from(cfg.bucket).upload(storageKey, result, {
      contentType: 'audio/mpeg',
      upsert: true,
    })

    const costUsd = usage.costUsdMicros / 1_000_000
    await prisma.aiGeneration.update({
      where: { id: genId },
      data: {
        status: 'READY',
        storageKey,
        costUsd: new Decimal(costUsd),
      },
    })
    await prisma.sfxCache.create({
      data: {
        id: createId('sfx'),
        workspaceId,
        promptHash: hash,
        generationId: genId,
        storageKey,
      },
    })
    await recordAiUsage({
      workspaceId,
      projectId: ctxAudio.projectId,
      clipId: ctxAudio.clipId ?? undefined,
      generationId: genId,
      usage,
    })

    return NextResponse.json({
      data: {
        generationId: genId,
        status: 'READY',
        cached: false,
        estimatedCostUsd: sfxCostUsd(body.durationSec),
        downloadUrl: await storage.createSignedDownloadUrl(storageKey, 3600),
      },
    })
  } catch (err) {
    return jsonError(err, 400)
  }
}

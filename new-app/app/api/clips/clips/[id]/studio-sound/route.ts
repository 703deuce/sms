import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { normalizeEdits, outputDurationMs } from '@/lib/clips/edits'
import { DEFAULT_STUDIO_SOUND_MIX, normalizeAudioEdits } from '@/lib/clips/audio'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { createId } from '@/lib/supabase/id'
import { resolveClipSourceMediaKey } from '@/lib/server/clips/clip-source-media'
import { writeClipEditsOrThrow } from '@/lib/server/clips/write-clip-edits'

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = (await request.json().catch(() => ({}))) as {
      previewOnly?: boolean
      windowStartMs?: number
      windowDurationMs?: number
    }
    const previewOnly = body.previewOnly === true
    const windowDurationMs = previewOnly
      ? Math.min(10_000, Math.max(1000, Math.round(body.windowDurationMs ?? 10_000)))
      : undefined
    const windowStartMs =
      previewOnly && Number.isFinite(body.windowStartMs)
        ? Math.max(0, Math.round(body.windowStartMs!))
        : undefined

    const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
    const edits = normalizeEdits(clip.edits, bounds)
    const lengthMs = Math.max(3000, Math.min(300_000, outputDurationMs(edits)))

    const prisma = getPrisma()
    const existing = await prisma.aiGeneration.findFirst({
      where: { clipId, kind: 'STUDIO_SOUND', status: { in: ['PENDING', 'RUNNING'] } },
      orderBy: { createdAt: 'desc' },
    })
    if (existing) {
      return NextResponse.json({
        data: { generationId: existing.id, jobId: null, status: existing.status, reused: true },
      })
    }

    const project = await prisma.clipProject.findFirst({
      where: { id: clip.projectId, workspaceId },
      include: { upload: true },
    })
    const sourceKey = resolveClipSourceMediaKey(
      {
        id: clip.id,
        projectId: clip.projectId,
        workspaceId,
        sourceSegKey: clip.sourceSegKey,
        previewKey: clip.previewKey,
      },
      project?.upload?.key,
    )
    if (!sourceKey) return NextResponse.json({ error: 'No source media for this clip' }, { status: 400 })

    const sourceOffsetMs =
      clip.sourceSegStartMs != null
        ? clip.sourceSegStartMs
        : clip.previewKey
          ? clip.startMs
          : 0

    console.info(
      `[editor:decision] ${JSON.stringify({
        event: 'studio_sound_enqueue',
        clipId,
        sourceKind: clip.sourceSegKey ? 'sourceSegKey' : clip.previewKey ? 'previewKey' : 'segment_or_upload',
      })}`,
    )

    const gen = await prisma.aiGeneration.create({
      data: {
        workspaceId,
        clipId,
        kind: 'STUDIO_SOUND',
        status: 'PENDING',
        provider: 'elevenlabs',
        prompt: 'studio-sound',
        params: {
          clipId,
          sourceKey,
          sourceOffsetMs,
          lengthMs,
          ...(previewOnly ? { previewOnly: true, windowStartMs, windowDurationMs } : {}),
        },
      },
    })

    const jobId = createId('job')
    await prisma.clipJob.create({
      data: {
        id: jobId,
        projectId: clip.projectId,
        clipId,
        type: 'STUDIO_SOUND',
        status: 'QUEUED',
        payload: { generationId: gen.id, clipId, sourceKey, sourceOffsetMs },
      },
    })

    const saved = previewOnly
      ? null
      : await writeClipEditsOrThrow(clipId, bounds, clip.editsSaveVersion, (cur) => {
          const audio = normalizeAudioEdits(cur.audio)
          return {
            ...cur,
            audio: {
              ...audio,
              studioSound: {
                enabled: true,
                generationId: gen.id,
                mix: audio.studioSound?.mix ?? DEFAULT_STUDIO_SOUND_MIX,
              },
            },
          }
        })

    return NextResponse.json({
      data: {
        generationId: gen.id,
        jobId,
        status: 'PENDING',
        previewOnly,
        ...(saved ? { editsSaveVersion: saved.editsSaveVersion } : {}),
      },
    })
  } catch (err) {
    return jsonError(err, 400)
  }
}

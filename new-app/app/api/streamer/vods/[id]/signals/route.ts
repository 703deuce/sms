import { NextResponse } from 'next/server'

import { jsonError } from '@/lib/server/api-error'
import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { resolveWorkspaceId } from '@/lib/server/workspace'

function downsample(series: number[], maxPoints = 2000): number[] {
  if (series.length <= maxPoints) return series
  const step = series.length / maxPoints
  const out: number[] = []
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.min(series.length - 1, Math.floor(i * step))
    out.push(series[idx] ?? 0)
  }
  return out
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const workspaceId = await resolveWorkspaceId()
    const { id } = await ctx.params
    const prisma = getPrisma()
    const vod = await prisma.streamVod.findFirst({
      where: { id, workspaceId },
      include: {
        project: {
          include: {
            clips: {
              where: { deletedAt: null },
              orderBy: [{ score: 'desc' }, { startMs: 'asc' }],
              select: { id: true, startMs: true, endMs: true, score: true },
            },
          },
        },
      },
    })
    if (!vod?.signalsKey) {
      return NextResponse.json({ error: 'Signals not ready' }, { status: 404 })
    }
    const storage = getClipStorage()
    const raw = await storage.getJson<{
      hz?: number
      combined?: number[]
      audio?: number[]
      transcript?: number[]
      chat?: number[] | null
      viewerClips?: number[] | null
      chapters?: unknown[]
    }>(vod.signalsKey)
    const combined = downsample(raw.combined ?? [])
    const res = NextResponse.json({
      hz: raw.hz ?? 1,
      combined,
      series: {
        audio: raw.audio ? downsample(raw.audio) : null,
        chat: raw.chat,
        viewerClips: raw.viewerClips,
        transcript: raw.transcript ? downsample(raw.transcript) : null,
      },
      clips: vod.project.clips.map((c) => ({
        id: c.id,
        startMs: c.startMs,
        endMs: c.endMs,
        total: c.score,
      })),
      chapters: raw.chapters ?? [],
    })
    res.headers.set('Cache-Control', 'private, max-age=300')
    return res
  } catch (err) {
    return jsonError(err, 400)
  }
}

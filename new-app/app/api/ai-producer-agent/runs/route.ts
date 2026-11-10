import { NextResponse } from 'next/server'
import { z } from 'zod'
import { aiProducerAgentDisabledResponse } from '@/lib/server/ai-producer-agent/api-guard'
import { jsonError } from '@/lib/server/api-error'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { createAiProducerAgentRun } from '@/lib/server/ai-producer-agent/runs'

const createSchema = z.object({
  sources: z
    .array(
      z.object({
        sourceId: z.string(),
        kind: z.enum(['stream', 'upload', 'clip']),
        projectId: z.string().optional(),
        clipId: z.string().optional(),
        storageKey: z.string().optional(),
        rangeMs: z.tuple([z.number(), z.number()]).optional(),
        durationMs: z.number().optional(),
        title: z.string().optional(),
      }),
    )
    .min(1),
  outputType: z.enum(['single_payoff', 'montage', 'story', 'auto']),
  editMode: z.enum(['just_chatting_rough_cut']).optional(),
  storyMode: z.enum(['single_source_v1','multi_source_story_v1','clean_take_v1','clip_moment_v1','clip_story_v1','clip_unified_v1']).optional(),
  roughCutIntent: z.enum(['story', 'highlights']).optional(),
  visualEvidenceMode: z.enum(['transcript_baseline','visual_audio']).optional(),
  genre: z.string().optional(),
  platform: z.enum(['tiktok', 'shorts', 'reels']).optional(),
  targetLengthS: z.tuple([z.number(), z.number()]).optional(),
  music: z.enum(['none', 'library']).optional(),
  memeSfx: z.enum(['off', 'subtle', 'meme']).optional(),
  instruction: z.string().max(4000).optional(),
  exportOnFinish: z.boolean().optional(),
})

export async function POST(request: Request) {
  const disabled = aiProducerAgentDisabledResponse()
  if (disabled) return disabled
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = createSchema.parse(await request.json())
    const run = await createAiProducerAgentRun(workspaceId, null, body)
    return NextResponse.json({ data: { runId: run.id, status: run.status } })
  } catch (err) {
    return jsonError(err, 400)
  }
}

export async function GET(request: Request) {
  const disabled = aiProducerAgentDisabledResponse()
  if (disabled) return disabled
  try {
    const workspaceId = await resolveWorkspaceId()
    const url = new URL(request.url)
    const projectId = url.searchParams.get('projectId')?.trim() || null
    const activeOnly = url.searchParams.get('active') === '1'
    console.info('[clips:agent-progress] restore_lookup_begin', { projectId, activeOnly })
    const { getPrisma } = await import('@/lib/server/db')
    const rows = await getPrisma().aiProducerAgentRun.findMany({
      where: {
        workspaceId,
        ...(activeOnly ? { status: { in: ['queued', 'running', 'planning', 'applying'] } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        status: true,
        phase: true,
        outputType: true,
        config: true,
        sourceSnapshot: true,
        resultProjectId: true,
        resultClipId: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    const runs = projectId
      ? rows.filter((row) => {
          const config = row.config && typeof row.config === 'object' && !Array.isArray(row.config)
            ? row.config as Record<string, unknown>
            : {}
          if (config.storyMode !== 'clip_unified_v1') return false
          if (!Array.isArray(row.sourceSnapshot)) return false
          return row.sourceSnapshot.some((source) =>
            source && typeof source === 'object' && !Array.isArray(source) &&
            (source as Record<string, unknown>).projectId === projectId)
        })
      : rows
    console.info('[clips:agent-progress] restore_lookup_end', {
      projectId,
      activeOnly,
      matches: runs.length,
      runId: runs[0]?.id ?? null,
    })
    return NextResponse.json({ data: { runs } })
  } catch (err) {
    console.error('[clips:agent-progress] restore_lookup_failed', { error: String(err) })
    return jsonError(err, 500)
  }
}

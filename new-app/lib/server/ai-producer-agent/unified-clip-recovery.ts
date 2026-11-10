import 'server-only'

import { getPrisma } from '@/lib/server/db'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import { rankSavedUnifiedClips } from '@/lib/ai-producer-agent/clip-mode/unified-recovery'
import { UNIFIED_OVERLAP_THRESHOLD } from '@/lib/ai-producer-agent/clip-mode/unified-merge'
import { clipperStageLog } from '@/lib/ai-producer-agent/clip-mode/clipper-stage-log'

const ACTIVE_PROJECT_STATUSES = ['QUEUED', 'PREPARING', 'TRANSCRIBING', 'SCANNING', 'FINDING_CLIPS', 'REFRAMING', 'RENDERING'] as const
const ACTIVE_RUN_STATUSES = ['queued', 'running', 'planning', 'applying', 'recovering', 'capped'] as const
const FRIENDLY_INTERRUPTED = 'Clipping was interrupted before any usable clips were saved. Select Retry processing to try again.'

export function unifiedRunIdFromSettings(settings: unknown): string | null {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return null
  const runId = (settings as Record<string, unknown>).unifiedClipRunId
  return typeof runId === 'string' && runId.trim() ? runId.trim() : null
}

/** Default 45 minutes with no DB activity; long specialist runs need room to work. */
export function unifiedRunStaleMs(envValue = process.env.UNIFIED_CLIP_STALE_MINUTES): number {
  const value = Number(envValue)
  return (Number.isFinite(value) && value >= 15 && value <= 240 ? value : 45) * 60_000
}

function runLog(projectId: string, runId: string, action: string, detail: Record<string, unknown> = {}) {
  clipperStageLog({
    stage: 'unified_recovery', action, projectId, runId, ...detail,
  })
}

type Candidate = { id: string }
type ClipRow = {
  id: string
  score: number
  startMs: number
  endMs: number
  editsSaveVersion: number
  updatedAt: Date
  aiMeta: unknown
}

/** Watchdog finalizer for web-redeploy interruptions. No model or video API is
 * called here. It reuses already-persisted editable clips and does not restart
 * PROCESS_PROJECT, re-transcribe, or charge the user again. */
export async function recoverUnifiedProject(projectId: string, now = new Date()): Promise<boolean> {
  const prisma = getPrisma()
  const started = Date.now()
  const project = await prisma.clipProject.findUnique({
    where: { id: projectId },
    select: { id: true, workspaceId: true, status: true, settings: true, deletedAt: true },
  })
  const runId = unifiedRunIdFromSettings(project?.settings)
  if (!project || project.deletedAt || !runId || !ACTIVE_PROJECT_STATUSES.includes(project.status as typeof ACTIVE_PROJECT_STATUSES[number])) return false

  runLog(projectId, runId, 'inspect_start', { projectStatus: project.status })
  const run = await prisma.aiProducerAgentRun.findFirst({
    where: { id: runId, workspaceId: project.workspaceId },
    select: { id: true, status: true, updatedAt: true, producerNotes: true },
  })
  const cutoff = new Date(now.getTime() - unifiedRunStaleMs())
  const terminal = run?.status === 'ready' || run?.status === 'done' ||
    run?.status === 'failed' || run?.status === 'canceled' || run?.status === 'capped'

  if (run && !terminal) {
    if (run.updatedAt >= cutoff) {
      runLog(projectId, runId, 'still_active', { ageMs: now.getTime() - run.updatedAt.getTime() })
      return false
    }
    // Latest persisted agent tool step is a better liveness signal than the
    // run's phase; one LLM candidate can be processing for several minutes.
    const recentStep = await prisma.aiProducerAgentStep.findFirst({
      where: { runId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true },
    })
    if (recentStep && recentStep.createdAt >= cutoff) {
      runLog(projectId, runId, 'recent_agent_step', { ageMs: now.getTime() - recentStep.createdAt.getTime() })
      return false
    }
  }
  if (run?.status === 'canceled') {
    const changed = await prisma.clipProject.updateMany({
      where: { id: projectId, status: { in: [...ACTIVE_PROJECT_STATUSES] } },
      data: { status: 'CANCELED', stage: 'canceled', error: null },
    })
    runLog(projectId, runId, 'canceled', { elapsedMs: Date.now() - started })
    return changed.count > 0
  }

  const clips = await prisma.clip.findMany({
    where: {
      workspaceId: project.workspaceId, projectId, deletedAt: null,
      aiMeta: { path: ['aiProducerRunId'], equals: runId },
    },
    select: {
      id: true, score: true, startMs: true, endMs: true,
      editsSaveVersion: true, updatedAt: true, aiMeta: true,
    },
    take: 200,
  }) as ClipRow[]
  if (run && !terminal && clips.some((clip) => clip.updatedAt >= cutoff)) {
    runLog(projectId, runId, 'recent_clip_update', { clipCount: clips.length })
    return false
  }

  // Atomic claim prevents two watchdog copies from both publishing a recovery.
  // A crashed watchdog's 'recovering' claim may be reclaimed after the same
  // quiet-window threshold.
  if (run && !terminal) {
    const claimed = await prisma.aiProducerAgentRun.updateMany({
      where: {
        id: runId, status: { in: [...ACTIVE_RUN_STATUSES] },
        updatedAt: { lt: cutoff },
      },
      data: { status: 'recovering', phase: 'recovery' },
    })
    if (!claimed.count) {
      runLog(projectId, runId, 'claim_lost')
      return false
    }
  }
  runLog(projectId, runId, 'claim_acquired', { clipCount: clips.length, runStatus: run?.status ?? 'missing' })

  const ranked = rankSavedUnifiedClips(clips)
  const saved = ranked.kept
  runLog(projectId, runId, 'rank_complete', {
    usable: saved.length,
    droppedDuplicates: ranked.droppedDuplicates.length,
    story: ranked.mix.story, continuous: ranked.mix.continuous,
  })
  if (!saved.length) {
    if (run) {
      await prisma.aiProducerAgentRun.updateMany({
        where: { id: runId, status: { in: [...ACTIVE_RUN_STATUSES, 'failed', 'capped'] } },
        data: { status: 'failed', phase: 'finish', finishedAt: now, error: FRIENDLY_INTERRUPTED },
      })
    }
    const failed = await prisma.clipProject.updateMany({
      where: { id: projectId, status: { in: [...ACTIVE_PROJECT_STATUSES] } },
      data: { status: 'FAILED', stage: 'failed', progress: 0, error: FRIENDLY_INTERRUPTED },
    })
    runLog(projectId, runId, 'failed_no_usable_clips', {
      elapsedMs: Date.now() - started, updated: failed.count,
    })
    return failed.count > 0
  }

  const originalNotes = run?.producerNotes && typeof run.producerNotes === 'object' && !Array.isArray(run.producerNotes)
    ? run.producerNotes as Record<string, unknown> : {}
  const keptIds = saved.map((clip) => clip.id)
  const droppedIds = ranked.droppedDuplicates.map((clip) => clip.droppedId)
  // Same story-majority rule as live unified merge may drop non-duplicate
  // continuous clips; keep these as soft-deleted rows, recoverable from DB.
  const unusedIds = clips.filter((clip) => !keptIds.includes(clip.id)).map((clip) => clip.id)

  for (const item of saved) {
    const clip = item.data!
    const original = clips.find((row) => row.id === clip.id)!
    await prisma.clip.update({
      where: { id: clip.id },
      data: {
        score: clip.score,
        aiMeta: toPrismaJson({
          ...clip.meta,
          aiProducerRunId: runId,
          type: clip.type,
          clipMode: clip.type === 'continuous' ? 'clip_moment_v1' : 'clip_story_v1',
          stitchSegments: clip.segments,
          overlaps: item.overlaps,
          needsReview: original.score <= 0 || clip.meta.needsReview === true,
          needsReviewReasons: original.score <= 0
            ? ['Recovered from interrupted processing; review this cut before publishing.']
            : Array.isArray(clip.meta.needsReviewReasons) ? clip.meta.needsReviewReasons : [],
          whyThisClip: typeof clip.meta.whyThisClip === 'string' ? clip.meta.whyThisClip :
            'Recovered from saved source footage after processing was interrupted.',
          recoveredFromInterruptedRun: true,
        }),
      },
    })
    runLog(projectId, runId, 'clip_ranked', {
      clipId: clip.id, score: clip.score, type: clip.type,
    })
  }
  if (unusedIds.length) {
    await prisma.clip.updateMany({
      where: { id: { in: unusedIds }, projectId, deletedAt: null },
      data: { deletedAt: now },
    })
    runLog(projectId, runId, 'duplicates_suppressed', {
      count: unusedIds.length, overlapDuplicates: droppedIds.length,
    })
  }

  if (run) {
    await prisma.aiProducerAgentRun.updateMany({
      where: { id: runId, status: { in: [...ACTIVE_RUN_STATUSES, 'failed', 'capped', 'ready', 'done'] } },
      data: {
        status: 'ready', phase: 'finish', finishedAt: now, error: null,
        resultProjectId: projectId, resultClipId: keptIds[0],
        outputProjectIds: toPrismaJson([projectId]),
        producerNotes: toPrismaJson({
          ...originalNotes,
          publishedClipCount: keptIds.length,
          publishedClipIds: keptIds,
          sourceProjectIds: [projectId],
          unifiedMix: ranked.mix,
          overlapThreshold: UNIFIED_OVERLAP_THRESHOLD,
          unifiedRecovery: {
            recoveredAt: now.toISOString(),
            reason: 'stale_or_interrupted_web_run',
            kept: keptIds.length,
            suppressed: unusedIds.length,
          },
        }),
      },
    })
  }
  const ready = await prisma.clipProject.updateMany({
    where: { id: projectId, status: { in: [...ACTIVE_PROJECT_STATUSES] } },
    data: { status: 'READY', stage: 'ready', progress: 100, error: null },
  })
  runLog(projectId, runId, 'finalize_ready', {
    elapsedMs: Date.now() - started, kept: saved.length, updated: ready.count,
  })
  return ready.count > 0
}

/** Scheduled from the already durable clips-worker reaper route. */
export async function reapStaleUnifiedRuns(): Promise<number> {
  const prisma = getPrisma()
  const started = Date.now()
  const candidates = await prisma.$queryRaw<Candidate[]>`
    SELECT id FROM clip_projects
    WHERE status IN ('QUEUED', 'PREPARING', 'TRANSCRIBING', 'SCANNING',
                     'FINDING_CLIPS', 'REFRAMING', 'RENDERING')
      AND "deletedAt" IS NULL
      AND (settings->>'unifiedClipRunId') IS NOT NULL
    ORDER BY "updatedAt" ASC
    LIMIT 30
  `
  let finalized = 0
  for (const candidate of candidates) {
    try {
      if (await recoverUnifiedProject(candidate.id)) finalized++
    } catch (err) {
      clipperStageLog({
        stage: 'unified_recovery', action: 'candidate_error', projectId: candidate.id,
        error: err, elapsedMs: Date.now() - started,
      })
    }
  }
  clipperStageLog({
    stage: 'unified_recovery', action: 'scan_complete',
    scanned: candidates.length, finalized, elapsedMs: Date.now() - started,
  })
  return finalized
}

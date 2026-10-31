import 'server-only'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { estimateMediaTranscribeUsd, mediaTranscribeCredits, mediaTranscribeUsdPerMin } from '@/lib/clips/media-transcribe-cost'
import type { MediaTranscript, MediaTranscriptEstimate } from '@/lib/clips/editor/media-words'

/**
 * E5b on-demand transcription of a project's own media: an uploaded clip (clip_project_media) or a
 * Rooms take track of the project. GET estimate → user accepts the shown cost → POST queues the
 * worker's MEDIA_TRANSCRIBE job (existing transcription path) → words land in clip_media_transcripts.
 */

export type MediaRefInput = { ref: 'upload' | 'take'; refId: string }

const STATUSES = new Set(['queued', 'running', 'done', 'failed'])

function usdPerMin(): number {
  return mediaTranscribeUsdPerMin(process.env.CLIPS_TRANSCRIBE_USD_PER_MIN)
}

/** Media of THIS project only (upload linked in its library, or a track of one of its Rooms takes). */
async function resolveMedia(
  workspaceId: string,
  projectId: string,
  input: MediaRefInput,
): Promise<{ durationMs: number | null; label: string; hasAudio: boolean | null } | null> {
  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({ where: { id: projectId, workspaceId, deletedAt: null }, select: { id: true } })
  if (!project) return null
  if (input.ref === 'upload') {
    const row = await prisma.clipProjectMedia.findFirst({
      where: { projectId, workspaceId, uploadId: input.refId },
      select: { mediaType: true, durationMs: true, label: true, hasAudio: true, upload: { select: { durationMs: true, filename: true } } },
    })
    if (!row || row.mediaType === 'image') return null
    return { durationMs: row.durationMs ?? row.upload.durationMs, label: row.label || row.upload.filename, hasAudio: row.hasAudio }
  }
  const track = await prisma.recordingTrack.findFirst({
    where: { id: input.refId, storageKey: { not: null }, take: { session: { projectId, workspaceId } } },
    select: { kind: true, take: { select: { startAtHostMs: true, stopAtHostMs: true } }, participant: { select: { displayName: true } } },
  })
  if (!track) return null
  const t = track.take
  const durationMs = t.stopAtHostMs != null ? Math.max(0, Number(t.stopAtHostMs - t.startAtHostMs)) : null
  return { durationMs, label: `${track.participant?.displayName ?? 'Participant'} · ${String(track.kind)}`, hasAudio: null }
}

function toTranscript(r: {
  ref: string
  refId: string
  status: string
  words: unknown
  language: string | null
  durationMs: number | null
  costUsdMicros: number | null
  estimatedUsdMicros: number | null
  error: string | null
}): MediaTranscript {
  // The internal provider-cost columns stay in the DB; the browser only ever gets credits.
  return {
    ref: r.ref === 'take' ? 'take' : 'upload',
    refId: r.refId,
    status: (STATUSES.has(r.status) ? r.status : 'failed') as MediaTranscript['status'],
    words: Array.isArray(r.words) ? (r.words as MediaTranscript['words']) : [],
    language: r.language,
    durationMs: r.durationMs,
    credits: r.durationMs != null && r.durationMs > 0 ? mediaTranscribeCredits(r.durationMs) : null,
    error: r.error,
  }
}

const SELECT = {
  ref: true,
  refId: true,
  status: true,
  words: true,
  language: true,
  durationMs: true,
  costUsdMicros: true,
  estimatedUsdMicros: true,
  error: true,
} as const

export async function listMediaTranscripts(workspaceId: string, projectId: string): Promise<MediaTranscript[] | null> {
  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({ where: { id: projectId, workspaceId, deletedAt: null }, select: { id: true } })
  if (!project) return null
  const rows = await prisma.clipMediaTranscript.findMany({ where: { projectId, workspaceId }, select: SELECT, take: 200 })
  return rows.map(toTranscript)
}

export async function estimateMediaTranscript(
  workspaceId: string,
  projectId: string,
  input: MediaRefInput,
): Promise<MediaTranscriptEstimate | null> {
  const media = await resolveMedia(workspaceId, projectId, input)
  if (!media) return null
  const durationMs = media.durationMs ?? 0
  return {
    ref: input.ref,
    refId: input.refId,
    label: media.label,
    durationMs: media.durationMs,
    credits: mediaTranscribeCredits(durationMs),
    durationKnown: media.durationMs != null && media.durationMs > 0,
    hasAudio: media.hasAudio,
  }
}

/**
 * Queue only when the caller accepted (at least) the current estimate — the cost is always shown
 * first. A finished or running transcript is returned as is (no second charge).
 */
export async function queueMediaTranscript(
  workspaceId: string,
  projectId: string,
  input: MediaRefInput & { acceptedCredits: number },
): Promise<MediaTranscript | null> {
  const est = await estimateMediaTranscript(workspaceId, projectId, input)
  if (!est) return null
  if (est.hasAudio === false) throw new Error('This clip has no sound to transcribe')
  if (!(input.acceptedCredits >= est.credits)) throw new Error('The credit cost changed — check the new estimate')
  const prisma = getPrisma()
  const existing = await prisma.clipMediaTranscript.findFirst({
    where: { projectId, workspaceId, ref: input.ref, refId: input.refId },
    select: { id: true, status: true },
  })
  if (existing && existing.status !== 'failed') {
    const row = await prisma.clipMediaTranscript.findFirst({ where: { id: existing.id }, select: SELECT })
    return row ? toTranscript(row) : null
  }
  const id = existing?.id ?? createId('mtr')
  // Internal provider-cost estimate for tracking only (never returned to the browser).
  const estimatedUsdMicros = Math.round(estimateMediaTranscribeUsd(est.durationMs ?? 0, usdPerMin()) * 1e6)
  const row = existing
    ? await prisma.clipMediaTranscript.update({
        where: { id },
        data: { status: 'queued', error: null, estimatedUsdMicros },
        select: SELECT,
      })
    : await prisma.clipMediaTranscript.create({
        data: { id, projectId, workspaceId, ref: input.ref, refId: input.refId, status: 'queued', estimatedUsdMicros },
        select: SELECT,
      })
  await prisma.clipJob.create({
    data: { id: createId('job'), projectId, type: 'MEDIA_TRANSCRIBE', status: 'QUEUED', payload: { transcriptId: id } },
  })
  return toTranscript(row)
}

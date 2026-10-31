import 'server-only'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage, getClipStorageForObjectKey } from '@/lib/storage'
import { resolveTracksForImport } from '@/lib/server/recording/resolve-import-tracks'
import type { ProjectMediaItem } from '@/lib/clips/editor/media-add'
import type { MediaType } from '@/lib/clips/editor/sources'

/**
 * E5 project media library. Files are ordinary ClipUploads (same bucket, signed uploads, limits —
 * created with kind 'media'); clip_project_media links them to a project. Rooms angles are listed
 * from the project's recording take (HQ track, BACKUP fallback — resolveTracksForImport) with the
 * host-clock sync the Rooms recorder already measures (recording_tracks.actualStartHostMs).
 */

const SIGN_TTL_S = 3600
const SYNC_STATUSES = new Set(['none', 'queued', 'done', 'failed', 'low_confidence'])

export function mediaTypeForMime(mime: string): MediaType | null {
  const m = (mime || '').toLowerCase()
  if (m.startsWith('video/')) return 'video'
  if (m.startsWith('image/')) return 'image'
  if (m.startsWith('audio/')) return 'audio'
  return null
}

async function loadProject(workspaceId: string, projectId: string) {
  const prisma = getPrisma()
  return prisma.clipProject.findFirst({
    where: { id: projectId, workspaceId, deletedAt: null },
    select: { id: true, uploadId: true, upload: { select: { key: true } } },
  })
}

async function sign(key: string, driver: string | null): Promise<string | null> {
  try {
    return await getClipStorage(driver).createSignedDownloadUrl(key, SIGN_TTL_S)
  } catch {
    return null
  }
}

type MediaRow = {
  id: string
  uploadId: string
  mediaType: string
  label: string | null
  durationMs: number | null
  width: number | null
  height: number | null
  syncOffsetMs: number | null
  syncConfidence: number | null
  syncStatus: string
  upload: { key: string; filename: string; storageDriver: string | null; durationMs: number | null; width: number | null; height: number | null }
}

async function toItem(r: MediaRow): Promise<ProjectMediaItem> {
  return {
    id: r.id,
    ref: 'upload',
    refId: r.uploadId,
    mediaType: (r.mediaType === 'image' || r.mediaType === 'audio' ? r.mediaType : 'video') as MediaType,
    label: r.label || r.upload.filename,
    durationMs: r.durationMs ?? r.upload.durationMs,
    width: r.width ?? r.upload.width,
    height: r.height ?? r.upload.height,
    url: await sign(r.upload.key, r.upload.storageDriver),
    syncMs: r.syncStatus === 'done' || r.syncStatus === 'low_confidence' ? r.syncOffsetMs : null,
    syncStatus: (SYNC_STATUSES.has(r.syncStatus) ? r.syncStatus : 'none') as ProjectMediaItem['syncStatus'],
    syncConfidence: r.syncConfidence,
  }
}

const MEDIA_SELECT = {
  id: true,
  uploadId: true,
  mediaType: true,
  label: true,
  durationMs: true,
  width: true,
  height: true,
  syncOffsetMs: true,
  syncConfidence: true,
  syncStatus: true,
  upload: { select: { key: true, filename: true, storageDriver: true, durationMs: true, width: true, height: true } },
} as const

/** Rooms angles of the take this project was imported from (the take whose track is the main source). */
async function roomsAngles(workspaceId: string, projectId: string, mainKey: string | null): Promise<ProjectMediaItem[]> {
  if (!mainKey) return []
  const prisma = getPrisma()
  const sessions = await prisma.recordingSession.findMany({
    where: { projectId, workspaceId },
    select: { takes: { select: { tracks: { include: { participant: true } } } } },
  })
  for (const s of sessions) {
    for (const take of s.takes) {
      const picked = resolveTracksForImport(take.tracks)
      const primary = picked.find((t) => t.storageKey === mainKey)
      if (!primary) continue
      const out: ProjectMediaItem[] = []
      for (const t of picked) {
        if (!t.storageKey || (t.kind !== 'CAMERA' && t.kind !== 'SCREEN')) continue
        const isMain = t.id === primary.id
        const syncMs =
          primary.actualStartHostMs != null && t.actualStartHostMs != null
            ? Number(primary.actualStartHostMs - t.actualStartHostMs)
            : 0
        let url: string | null = null
        try {
          url = await (await getClipStorageForObjectKey(t.storageKey)).createSignedDownloadUrl(t.storageKey, SIGN_TTL_S)
        } catch {
          url = null
        }
        out.push({
          id: `take:${t.id}`,
          ref: 'take',
          refId: t.id,
          mediaType: 'video',
          label: `${t.participant?.displayName ?? 'Participant'} · ${t.kind === 'SCREEN' ? 'Screen' : 'Camera'}`,
          durationMs: null,
          width: null,
          height: null,
          url,
          syncMs: isMain ? 0 : syncMs,
          syncStatus: 'clock',
          ...(isMain ? { isMain: true } : {}),
        })
      }
      return out
    }
  }
  return []
}

export async function listProjectMedia(workspaceId: string, projectId: string): Promise<ProjectMediaItem[] | null> {
  const project = await loadProject(workspaceId, projectId)
  if (!project) return null
  const prisma = getPrisma()
  const rows = await prisma.clipProjectMedia.findMany({
    where: { projectId, workspaceId },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: MEDIA_SELECT,
  })
  const uploads = await Promise.all(rows.map((r) => toItem(r)))
  const angles = await roomsAngles(workspaceId, projectId, project.upload?.key ?? null)
  return [...angles, ...uploads]
}

export async function registerProjectMedia(
  workspaceId: string,
  projectId: string,
  input: { uploadId: string; label?: string; durationMs?: number; width?: number; height?: number; hasAudio?: boolean },
): Promise<ProjectMediaItem | null> {
  const project = await loadProject(workspaceId, projectId)
  if (!project) return null
  const prisma = getPrisma()
  const upload = await prisma.clipUpload.findFirst({
    where: { id: input.uploadId, workspaceId, status: 'COMPLETE' },
    select: { id: true, mime: true, filename: true, durationMs: true, width: true, height: true },
  })
  if (!upload) throw new Error('Upload not found or not finished')
  if (upload.id === project.uploadId) throw new Error('This is already the main video of the project')
  const mediaType = mediaTypeForMime(upload.mime)
  if (!mediaType) throw new Error('Only video, image and audio files can be added')
  const meta = {
    label: input.label?.slice(0, 200) || upload.filename,
    durationMs: mediaType === 'image' ? null : input.durationMs ?? upload.durationMs,
    width: input.width ?? upload.width,
    height: input.height ?? upload.height,
    hasAudio: input.hasAudio ?? null,
  }
  const row = await prisma.clipProjectMedia.upsert({
    where: { projectId_uploadId: { projectId, uploadId: upload.id } },
    create: { id: createId('pmed'), projectId, workspaceId, uploadId: upload.id, mediaType, ...meta },
    update: meta,
    select: MEDIA_SELECT,
  })
  return toItem(row)
}

/** Detach from the library (the upload itself stays). Refused while a clip of the project uses it. */
export async function removeProjectMedia(workspaceId: string, projectId: string, mediaId: string): Promise<'ok' | 'not_found' | 'in_use'> {
  const prisma = getPrisma()
  const row = await prisma.clipProjectMedia.findFirst({ where: { id: mediaId, projectId, workspaceId }, select: { uploadId: true } })
  if (!row) return 'not_found'
  const clips = await prisma.clip.findMany({ where: { projectId, workspaceId, deletedAt: null }, select: { edits: true } })
  if (clips.some((c) => JSON.stringify(c.edits ?? {}).includes(`"${row.uploadId}"`))) return 'in_use'
  await prisma.clipProjectMedia.deleteMany({ where: { id: mediaId, projectId, workspaceId } })
  return 'ok'
}

/** Queue the worker's audio sync (MEDIA_SYNC) of an uploaded angle against the main source. */
export async function queueMediaSync(workspaceId: string, projectId: string, mediaId: string): Promise<ProjectMediaItem | null> {
  const project = await loadProject(workspaceId, projectId)
  if (!project) return null
  if (!project.uploadId) throw new Error('Audio sync needs an uploaded main video')
  const prisma = getPrisma()
  const row = await prisma.clipProjectMedia.findFirst({ where: { id: mediaId, projectId, workspaceId }, select: { mediaType: true } })
  if (!row) return null
  if (row.mediaType !== 'video') throw new Error('Only video angles can be synced')
  await prisma.clipJob.create({
    data: { id: createId('job'), projectId, type: 'MEDIA_SYNC', status: 'QUEUED', payload: { mediaId } },
  })
  const updated = await prisma.clipProjectMedia.update({
    where: { id: mediaId },
    data: { syncStatus: 'queued' },
    select: MEDIA_SELECT,
  })
  return toItem(updated)
}

import 'server-only'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage, storageDriverName } from '@/lib/storage'
import { clipProjectSettingsSchema, defaultClipSettings } from '@/lib/clips/settings'
import { projectWordsKey } from '@/lib/storage'
import { ensureFullComposition } from '@/lib/server/clips/script-composition'
import { resolveTracksForImport } from '@/lib/server/recording/resolve-import-tracks'

export async function finalizeRecordingTakeToProject(
  workspaceId: string,
  sessionId: string,
  takeId: string,
  opts: { preferCloudBackup?: boolean } = {},
) {
  const prisma = getPrisma()
  const take = await prisma.recordingTake.findFirst({
    where: { id: takeId, sessionId },
    include: {
      session: true,
      tracks: { include: { participant: true }, orderBy: { actualStartHostMs: 'asc' } },
    },
  })
  if (!take || take.session.workspaceId !== workspaceId) throw new Error('Take not found')

  const uploaded = resolveTracksForImport(take.tracks, { preferCloudBackup: opts.preferCloudBackup })
  if (!uploaded.length) throw new Error('No uploaded tracks')

  const primary =
    uploaded.find(
      (t) => t.kind === 'CAMERA' && (t.participant as { role?: string } | undefined)?.role === 'HOST',
    ) ??
    uploaded.find((t) => t.kind === 'CAMERA') ??
    uploaded[0]

  const storage = getClipStorage(storageDriverName())
  const size = primary.storageKey ? await storage.getObjectSizeBytes(primary.storageKey) : null

  const uploadId = createId('upl')
  await prisma.clipUpload.create({
    data: {
      id: uploadId,
      workspaceId,
      key: primary.storageKey!,
      filename: `rooms-${take.session.title}.webm`,
      bytes: BigInt(size ?? 0),
      mime: primary.mimeType,
      status: 'COMPLETE',
      storageDriver: storageDriverName(),
      uploadMode: 's3_multipart',
    },
  })

  const projectId = take.session.projectId ?? createId('proj')
  const settings = clipProjectSettingsSchema.parse(defaultClipSettings())

  if (!take.session.projectId) {
    await prisma.clipProject.create({
      data: {
        id: projectId,
        workspaceId,
        title: `${take.session.title} (Rooms)`,
        uploadId,
        settings: JSON.parse(JSON.stringify(settings)),
        rangeStartMs: 0,
        rangeEndMs: 0,
        status: 'QUEUED',
        stage: 'queued',
        progress: 0,
        transcriptKey: projectWordsKey(workspaceId, projectId),
      },
    })
  }

  await prisma.scriptMediaAsset.create({
    data: {
      id: createId('sma'),
      projectId,
      workspaceId,
      durationMs: 1,
      sourceKey: primary.storageKey!,
    },
  })

  await ensureFullComposition(workspaceId, projectId, `${take.session.title} (Rooms)`, [])

  await prisma.recordingSession.update({
    where: { id: sessionId },
    data: { projectId, status: 'PROCESSING' },
  })

  const jobId = createId('job')
  await prisma.clipJob.create({
    data: {
      id: jobId,
      projectId,
      type: 'PROCESS_PROJECT',
      status: 'QUEUED',
      payload: {
        recordingTakeId: takeId,
        multitrack: true,
        tracks: uploaded.map((t) => ({
          trackId: t.id,
          participantId: t.participantId,
          displayName: t.participant?.displayName ?? 'Participant',
          kind: t.kind,
          storageKey: t.storageKey,
          mimeType: t.mimeType,
          actualStartHostMs: t.actualStartHostMs?.toString() ?? '0',
          sampleRate: t.sampleRate,
          qualitySource: t.qualitySource,
        })),
      },
    },
  })

  return { projectId, scriptUrl: `/app/clips/${projectId}/script` }
}

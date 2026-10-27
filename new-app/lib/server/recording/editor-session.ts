import 'server-only'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'

/** Solo editor capture — no LiveKit room; browser MediaRecorder + B2 multipart only. */
export async function getOrCreateEditorSoloSession(workspaceId: string, projectId: string, title: string) {
  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true, title: true },
  })
  if (!project) throw new Error('Project not found')

  const existing = await prisma.recordingSession.findFirst({
    where: {
      workspaceId,
      projectId,
      kind: 'EDITOR_SOLO',
      status: { in: ['DRAFT', 'LIVE'] },
    },
    include: { participants: { where: { role: 'HOST' }, take: 1 } },
  })
  if (existing) {
    const host = existing.participants[0]
    if (!host) throw new Error('Host participant missing')
    return { session: existing, hostParticipantId: host.id }
  }

  const sessionId = createId('recs')
  const hostId = createId('recp')
  const session = await prisma.recordingSession.create({
    data: {
      id: sessionId,
      workspaceId,
      projectId,
      title: title || project.title,
      livekitRoom: `editor_${sessionId}`,
      kind: 'EDITOR_SOLO',
      cloudBackupEnabled: false,
      transcriptionEnabled: false,
      status: 'DRAFT',
      maxParticipants: 1,
      participants: {
        create: {
          id: hostId,
          role: 'HOST',
          displayName: 'Editor',
          status: 'LIVE',
        },
      },
    },
    include: { participants: true },
  })
  return { session, hostParticipantId: hostId }
}

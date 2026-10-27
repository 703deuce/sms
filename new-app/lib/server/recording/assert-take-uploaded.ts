import 'server-only'
import { getPrisma } from '@/lib/server/db'

export async function assertTakeTracksFullyUploaded(sessionId: string, takeId: string, workspaceId: string) {
  const prisma = getPrisma()
  const take = await prisma.recordingTake.findFirst({
    where: { id: takeId, sessionId },
    include: { session: true, tracks: true },
  })
  if (!take || take.session.workspaceId !== workspaceId) throw new Error('Take not found')
  if (!take.tracks.length) throw new Error('No tracks on take')
  const { resolveTracksForImport } = await import('@/lib/server/recording/resolve-import-tracks')
  const resolved = resolveTracksForImport(take.tracks)
  if (!resolved.length) {
    const pending = take.tracks.filter((t) => t.status !== 'UPLOADED' || !t.storageKey)
    throw new Error(`Waiting for uploads (${pending.length} track(s) pending)`)
  }
  return take
}

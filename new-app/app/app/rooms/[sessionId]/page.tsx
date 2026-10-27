import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { RoomsPrejoinGate } from '@/components/recording/rooms/rooms-prejoin-gate'
import { isRecordingFeatureEnabled } from '@/lib/server/clips/feature-gates'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'

type Props = { params: Promise<{ sessionId: string }> }

export default async function RoomsPrejoinPage({ params }: Props) {
  if (!isRecordingFeatureEnabled()) redirect('/app/clips')
  const { sessionId } = await params
  const workspaceId = await resolveWorkspaceId()
  const prisma = getPrisma()
  const session = await prisma.recordingSession.findFirst({
    where: { id: sessionId, workspaceId },
    select: { id: true, title: true },
  })
  if (!session) notFound()
  const cookieStore = await cookies()
  const hostFromCookie = cookieStore.get(`rooms_host_${session.id}`)?.value === '1'
  return (
    <RoomsPrejoinGate
      sessionId={session.id}
      sessionTitle={session.title}
      hostFromCookie={hostFromCookie}
    />
  )
}

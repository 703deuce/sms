import { notFound, redirect } from 'next/navigation'
import { RoomsPrejoinClient } from '@/components/recording/rooms/prejoin-client'
import { isRecordingFeatureEnabled } from '@/lib/server/clips/feature-gates'
import { mintHostTokenForSession } from '@/lib/server/recording/sessions'
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
  const creds = await mintHostTokenForSession(sessionId, workspaceId)
  if (!creds) notFound()
  return (
    <RoomsPrejoinClient
      sessionId={session.id}
      sessionTitle={session.title}
      role="HOST"
      token={creds.token}
      livekitUrl={creds.url}
      identity={creds.identity}
    />
  )
}

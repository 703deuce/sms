import { notFound, redirect } from 'next/navigation'
import { RoomsStudioApp } from '@/components/recording/rooms/rooms-studio-app'
import { isRecordingFeatureEnabled } from '@/lib/server/clips/feature-gates'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'

type Props = { params: Promise<{ sessionId: string }> }

export default async function RoomsStudioPage({ params }: Props) {
  if (!isRecordingFeatureEnabled()) redirect('/app/clips')
  const { sessionId } = await params
  const workspaceId = await resolveWorkspaceId()
  const session = await getPrisma().recordingSession.findFirst({
    where: { id: sessionId, workspaceId },
    select: { title: true },
  })
  if (!session) notFound()
  return <RoomsStudioApp sessionId={sessionId} sessionTitle={session.title} />
}

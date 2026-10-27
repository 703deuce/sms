import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { PrimaryButton } from '@/components/app/primary-button'
import { RoomsFullPage, RoomsTopBar } from '@/components/recording/rooms/rooms-layout-shell'
import { UploadRecoveryClient } from '@/components/recording/rooms/upload-recovery-client'
import { isRecordingFeatureEnabled } from '@/lib/server/clips/feature-gates'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'

type Props = { params: Promise<{ sessionId: string }> }

/** §25 recovery / upload status page */
export default async function RoomsUploadPage({ params }: Props) {
  if (!isRecordingFeatureEnabled()) redirect('/app/clips')
  const { sessionId } = await params
  const workspaceId = await resolveWorkspaceId()
  const session = await getPrisma().recordingSession.findFirst({
    where: { id: sessionId, workspaceId },
    select: { title: true },
  })
  if (!session) notFound()

  return (
    <RoomsFullPage>
      <RoomsTopBar title="Upload recordings" />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        <h1 className="text-xl font-semibold">Recover your recording</h1>
        <p className="max-w-md text-center text-sm text-muted-foreground">
          Files are kept in this browser while upload finishes. Do not close the tab until every track shows a checkmark.
        </p>
        <UploadRecoveryClient sessionId={sessionId} />
      </div>
    </RoomsFullPage>
  )
}

import { redirect } from 'next/navigation'
import { UploadRecoveryClient } from '@/components/recording/rooms/upload-recovery-client'
import { isSoloEditorRecordingEnabled, isRecordingFeatureEnabled } from '@/lib/server/clips/feature-gates'

type Params = { params: Promise<{ sessionId: string }> }

export default async function RecordRecoverPage({ params }: Params) {
  if (!isSoloEditorRecordingEnabled() && !isRecordingFeatureEnabled()) {
    redirect('/app/clips')
  }
  const { sessionId } = await params
  return <UploadRecoveryClient sessionId={sessionId} />
}

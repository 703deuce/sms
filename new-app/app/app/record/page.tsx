import { redirect } from 'next/navigation'
import { SoloRecordClient } from '@/components/recording/solo/solo-record-client'
import { isSoloEditorRecordingEnabled } from '@/lib/server/clips/feature-gates'

export default function RecordPage() {
  if (!isSoloEditorRecordingEnabled()) {
    redirect('/app/clips')
  }
  return <SoloRecordClient />
}

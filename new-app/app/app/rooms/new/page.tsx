import { redirect } from 'next/navigation'
import { RoomsNewClient } from '@/components/recording/rooms/new-session-client'
import { isRecordingFeatureEnabled } from '@/lib/server/clips/feature-gates'

export default function RoomsNewPage() {
  if (!isRecordingFeatureEnabled()) {
    redirect('/app/clips')
  }
  return <RoomsNewClient />
}

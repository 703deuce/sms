import { redirect } from 'next/navigation'
import { isRecordingFeatureEnabled } from '@/lib/server/clips/feature-gates'

export default function RoomsIndexPage() {
  if (!isRecordingFeatureEnabled()) {
    redirect('/app/clips')
  }
  redirect('/app/rooms/new')
}

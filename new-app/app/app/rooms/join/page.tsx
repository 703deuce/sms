import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { GuestJoinClient } from '@/components/recording/rooms/guest-join-client'
import { isRecordingFeatureEnabled } from '@/lib/server/clips/feature-gates'

export default function RoomsGuestJoinPage() {
  if (!isRecordingFeatureEnabled()) {
    redirect('/app/clips')
  }
  return (
    <Suspense>
      <GuestJoinClient />
    </Suspense>
  )
}

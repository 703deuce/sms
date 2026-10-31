import { redirect } from 'next/navigation'
import { isRecordingFeatureEnabled } from '@/lib/server/clips/feature-gates'

/**
 * Rooms is its own entry on the main screen. It is gated only by LiveKit recording
 * (FEATURE_SCRIPT_RECORDING + LiveKit env), not by the paused /script editor flag.
 */
export default function RoomsSectionLayout({ children }: { children: React.ReactNode }) {
  if (!isRecordingFeatureEnabled()) redirect('/app/clips')
  return children
}

'use client'

import { useRecordingConfig } from '@/lib/recording/use-recording-config'

/** LiveKit Rooms recording (legacy name). */
export function useRecordingEnabled() {
  const { roomsEnabled } = useRecordingConfig()
  return roomsEnabled
}

export function useSoloRecordingEnabled() {
  const { soloEnabled } = useRecordingConfig()
  return soloEnabled
}

import 'server-only'
import {
  isRecordingFeatureEnabled,
  isSoloEditorRecordingEnabled,
} from '@/lib/server/clips/feature-gates'

/** LiveKit Rooms + guest flows */
export function isRoomsRecordingApiEnabled(): boolean {
  return isRecordingFeatureEnabled()
}

/** Browser MediaRecorder + IndexedDB + multipart (no LiveKit room). */
export function isSoloRecordingApiEnabled(): boolean {
  return isSoloEditorRecordingEnabled()
}

/** Multipart track upload endpoints (solo + Rooms). */
export function isTrackUploadApiEnabled(): boolean {
  return isSoloEditorRecordingEnabled() || isRecordingFeatureEnabled()
}

import 'server-only'

export function recordingTrackObjectKey(workspaceId: string, sessionId: string, trackId: string, ext: string) {
  return `recordings/${workspaceId}/${sessionId}/${trackId}.${ext}`
}

import 'server-only'

export function recordingTrackObjectKey(workspaceId: string, sessionId: string, trackId: string, ext: string) {
  return `clips/${workspaceId}/recording/${sessionId}/${trackId}.${ext}`
}

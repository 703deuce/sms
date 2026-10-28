/** Object key for padded streamer source segment (survives VOD cleanup). */
export function clipSourceSegmentKey(workspaceId: string, projectId: string, clipId: string) {
  return `ws/${workspaceId}/projects/${projectId}/clips/${clipId}/source_seg.mp4`
}

/** Resolve media object key for export / studio sound when project upload is gone. */
export function resolveClipSourceMediaKey(
  clip: {
    id: string
    projectId: string
    workspaceId: string
    sourceSegKey: string | null
    previewKey: string | null
  },
  projectUploadKey: string | null | undefined,
): string | null {
  if (clip.sourceSegKey) return clip.sourceSegKey
  return (
    clipSourceSegmentKey(clip.workspaceId, clip.projectId, clip.id) ||
    clip.previewKey ||
    projectUploadKey ||
    null
  )
}

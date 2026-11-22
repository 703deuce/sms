import type { ClipEditsV2 } from '@/lib/clips/edits'

/** User explicitly opted in via the Level speech volume toggle. */
export function isSpeechLevelingEnabled(edits: Pick<ClipEditsV2, 'speechLevelingEnabled'>): boolean {
  return edits.speechLevelingEnabled === true
}

/** LUFS target applied on export/preview render — only when the user opted in. */
export function exportLoudnessLufs(
  edits: Pick<ClipEditsV2, 'speechLevelingEnabled' | 'loudnessLufs'>,
): ClipEditsV2['loudnessLufs'] | undefined {
  if (!isSpeechLevelingEnabled(edits)) return undefined
  return typeof edits.loudnessLufs === 'number' && Number.isFinite(edits.loudnessLufs)
    ? edits.loudnessLufs : -15
}

export function speechLevelingPatch(enabled: boolean): Pick<ClipEditsV2, 'speechLevelingEnabled' | 'loudnessLufs'> {
  if (enabled) {
    return { speechLevelingEnabled: true, loudnessLufs: -15 }
  }
  return { speechLevelingEnabled: undefined, loudnessLufs: undefined }
}

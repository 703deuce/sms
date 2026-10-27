import { clipsFetch } from '@/lib/clips-api'
import {
  loadExportDialogPreferences,
  saveExportDialogPreferences,
} from '@/lib/clips/export-preferences'
import type { ClipExportUserPreferences } from '@/lib/clips/clip-export-user-types'

export function persistExportDialogPreferences(patch: Partial<ClipExportUserPreferences>): void {
  saveExportDialogPreferences(patch)
  void clipsFetch<ClipExportUserPreferences>('/api/clips/export-user-preferences', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }).catch(() => {})
}

export async function loadMergedExportDialogPreferences(): Promise<ClipExportUserPreferences> {
  const local = loadExportDialogPreferences()
  try {
    const server = await clipsFetch<ClipExportUserPreferences>('/api/clips/export-user-preferences')
    return { ...local, ...server }
  } catch {
    return local
  }
}

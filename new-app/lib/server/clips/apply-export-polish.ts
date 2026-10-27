import { applyClipPolishToEdits } from '@/lib/clips/clip-polish'
import type { ExportPlatformId } from '@/lib/clips/export-platform-presets'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'

export function applyExportPolishEdits(
  edits: ClipEditsV2,
  opts: {
    exportPlatform?: ExportPlatformId | null
    streamClip?: boolean
    words?: SourceWord[]
    removeDeadAir?: boolean
    hookText?: string | null
  },
): ClipEditsV2 {
  return applyClipPolishToEdits(edits, {
    exportPlatform: opts.exportPlatform ?? null,
    streamClip: opts.streamClip,
    words: opts.words,
    hookText: opts.hookText,
    applySilenceCuts: opts.removeDeadAir !== false,
  })
}

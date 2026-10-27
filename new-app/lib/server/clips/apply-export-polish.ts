import { applyClipPolishToEdits } from '@/lib/clips/clip-polish'
import type { ExportPlatformId } from '@/lib/clips/export-platform-presets'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'
import { applyLoopFriendlyTrimToEdits, loopFriendlyEndDefault } from '@/lib/clips/loop-friendly-trim'
import { normalizeExportSfxMode } from '@/lib/clips/export-sfx'

export function applyExportPolishEdits(
  edits: ClipEditsV2,
  opts: {
    exportPlatform?: ExportPlatformId | null
    streamClip?: boolean
    words?: SourceWord[]
    removeDeadAir?: boolean
    hookText?: string | null
    exportSfx?: 'off' | 'subtle' | 'meme'
  },
): ClipEditsV2 {
  let next = applyClipPolishToEdits(edits, {
    exportPlatform: opts.exportPlatform ?? null,
    streamClip: opts.streamClip,
    words: opts.words,
    hookText: opts.hookText,
    applySilenceCuts: opts.removeDeadAir !== false,
  })
  if (opts.exportSfx) {
    next = { ...next, exportSfx: normalizeExportSfxMode(opts.exportSfx) }
  }
  if (opts.exportPlatform && next.loopFriendlyEnd === undefined) {
    next = { ...next, loopFriendlyEnd: loopFriendlyEndDefault(opts.exportPlatform) }
  }
  if (opts.words?.length) {
    next = applyLoopFriendlyTrimToEdits(next, opts.words, {
      exportPlatform: opts.exportPlatform ?? null,
    })
  }
  return next
}

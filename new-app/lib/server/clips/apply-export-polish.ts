import { applyClipPolishToEdits } from '@/lib/clips/clip-polish'
import type { ExportPlatformId } from '@/lib/clips/export-platform-presets'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { ClipWord } from '@/lib/clips/edits'
import { loadSourceWords } from '@/lib/clips/source-words'
import { applyLoopFriendlyTrimToEdits, loopFriendlyEndDefault } from '@/lib/clips/loop-friendly-trim'
import { normalizeExportSfxMode } from '@/lib/clips/export-sfx'

export function applyExportPolishEdits(
  edits: ClipEditsV2,
  opts: {
    exportPlatform?: ExportPlatformId | null
    streamClip?: boolean
    words?: ClipWord[]
    removeDeadAir?: boolean
    hookText?: string | null
    exportSfx?: 'off' | 'subtle' | 'meme'
  },
): ClipEditsV2 {
  const words = opts.words?.length ? loadSourceWords(opts.words) : undefined
  let next = applyClipPolishToEdits(edits, {
    exportPlatform: opts.exportPlatform ?? null,
    streamClip: opts.streamClip,
    words,
    hookText: opts.hookText,
    applySilenceCuts: opts.removeDeadAir !== false,
  })
  if (opts.exportSfx) {
    next = { ...next, exportSfx: normalizeExportSfxMode(opts.exportSfx) }
  }
  if (opts.exportPlatform && next.loopFriendlyEnd === undefined) {
    next = { ...next, loopFriendlyEnd: loopFriendlyEndDefault(opts.exportPlatform) }
  }
  if (words?.length) {
    next = applyLoopFriendlyTrimToEdits(next, words, {
      exportPlatform: opts.exportPlatform ?? null,
    })
  }
  return next
}

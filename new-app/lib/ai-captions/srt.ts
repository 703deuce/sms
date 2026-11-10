import { captionLinesToSrt, type CaptionLine } from '@/lib/clips/editor/caption-lines'
import type { AiCaptionsLine } from '@/lib/ai-captions/types'

export function srtFromLines(lines: AiCaptionsLine[]): string {
  const rows: CaptionLine[] = lines.map((l) => ({
    id: l.id,
    text: l.text,
    startMs: l.startMs,
    endMs: l.endMs,
  }))
  return captionLinesToSrt(rows)
}

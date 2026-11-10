import { LOW_CONFIDENCE_THRESHOLD, type AiCaptionsWord, type TranscriptWord } from '@/lib/ai-captions/types'

export function isLowConfidence(confidence: number | undefined): boolean {
  return typeof confidence === 'number' && Number.isFinite(confidence) && confidence < LOW_CONFIDENCE_THRESHOLD
}

export function transcriptToCaptionWords(words: TranscriptWord[]): AiCaptionsWord[] {
  return words.map((word) => {
    const text = String(word.w ?? '').trim()
    const startMs = Math.max(0, Math.round((word.s ?? 0) * 1000))
    const endMs = Math.max(startMs, Math.round((word.e ?? word.s ?? 0) * 1000))
    const confidence = typeof word.p === 'number' && Number.isFinite(word.p) ? word.p : undefined
    const out: AiCaptionsWord = {
      text,
      startMs,
      endMs,
      lowConfidence: isLowConfidence(confidence),
    }
    if (confidence !== undefined) out.confidence = confidence
    return out
  }).filter((w) => w.text.length > 0)
}

export function captionWordsCoverTranscript(
  transcript: TranscriptWord[],
  words: AiCaptionsWord[],
): { ok: boolean; missing: string[] } {
  const expected = transcript
    .map((w) => String(w.w ?? '').trim())
    .filter(Boolean)
  const got = words.map((w) => w.text.trim())
  const missing: string[] = []
  const remaining = [...got]
  for (const text of expected) {
    const idx = remaining.findIndex((row) => row === text)
    if (idx === -1) missing.push(text)
    else remaining.splice(idx, 1)
  }
  if (expected.length !== got.length) {
    return { ok: false, missing: missing.length ? missing : [`count ${got.length} !== ${expected.length}`] }
  }
  return { ok: missing.length === 0, missing }
}

export function linesCoverWords(
  words: AiCaptionsWord[],
  lines: Array<{ text: string }>,
): boolean {
  const joined = lines.map((l) => l.text).join(' ').split(/\s+/).filter(Boolean)
  const expected = words.map((w) => w.text).filter(Boolean)
  if (joined.length !== expected.length) return false
  return expected.every((text, i) => joined[i] === text)
}

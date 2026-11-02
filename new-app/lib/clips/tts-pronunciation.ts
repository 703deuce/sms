import type { VocabEntry } from '@/lib/clips/clip-export-user-types'

/** Apply project pronunciation respellings (Q4 TTS dictionary) before ElevenLabs synthesis. */
export function applyTtsPronunciation(text: string, vocabulary: VocabEntry[] | undefined): string {
  let out = text
  for (const row of vocabulary ?? []) {
    const speak = row.speakAs?.trim()
    if (!speak) continue
    const from = row.from.trim()
    if (from.length < 2) continue
    const re = new RegExp(`\\b${escapeRegExp(from)}\\b`, 'gi')
    out = out.replace(re, speak)
  }
  return out
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

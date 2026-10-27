import type { T2vScene } from '@/lib/t2v/types'

export function estimateSceneMs(s: Pick<T2vScene, 'narration' | 'padMs' | 'minDurMs' | 'voice'>): number {
  if (s.voice?.durationMs) return s.voice.durationMs + s.padMs
  const words = s.narration.trim() ? s.narration.trim().split(/\s+/).length : 0
  return Math.max(s.minDurMs ?? 2000, (words / 2.5) * 1000 + s.padMs)
}

export const DUB_LANGUAGES: { code: string; label: string }[] = [
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'it', label: 'Italian' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'ar', label: 'Arabic' },
  { code: 'zh', label: 'Chinese' },
]

/** ElevenLabs Dubbing v1 clean tier: $0.50 / source minute */
export function dubCostUsd(durationMs: number): number {
  const minutes = Math.max(1, durationMs) / 60_000
  return minutes * 0.5
}

export function parseAudioTrack(track?: string | null): { kind: 'original' } | { kind: 'dub'; dubTrackId: string } {
  if (!track || track === 'original') return { kind: 'original' }
  if (track.startsWith('dub:')) return { kind: 'dub', dubTrackId: track.slice(4) }
  return { kind: 'original' }
}

export function audioTrackForDub(dubTrackId: string): string {
  return `dub:${dubTrackId}`
}

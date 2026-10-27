const VIDEO_CANDIDATES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/mp4;codecs=avc1.640028',
  'video/mp4',
]
const AUDIO_CANDIDATES = ['audio/webm;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4']

export function pickRecorderMime(kind: 'video' | 'audio'): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const list = kind === 'video' ? VIDEO_CANDIDATES : AUDIO_CANDIDATES
  return list.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
}

export function videoBitsPerSecond() {
  return 8_000_000
}

export function audioBitsPerSecond() {
  return 256_000
}

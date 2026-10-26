export function kieVideoCostUsd(durationS: number, resolution: '480p' | '720p'): number {
  const rate = resolution === '720p' ? 0.08 : 0.04
  return Math.round(durationS * rate * 10000) / 10000
}

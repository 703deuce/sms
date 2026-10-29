import type { CSSProperties } from 'react'
import type { FacecamBox } from '@/lib/clips/edits'
import { stackHeights } from '@/lib/streamer/layout-math'

/** CSS to show a normalized source crop filling a container (object-cover math). */
export function coverBoxStyle(box: FacecamBox): CSSProperties {
  const w = Math.max(0.01, box.w)
  const h = Math.max(0.01, box.h)
  return {
    objectFit: 'cover',
    objectPosition: `${(box.x + w / 2) * 100}% ${(box.y + h / 2) * 100}%`,
    width: `${100 / w}%`,
    height: `${100 / h}%`,
    maxWidth: 'none',
    position: 'absolute',
    left: `${(-box.x / w) * 100}%`,
    top: `${(-box.y / h) * 100}%`,
  }
}

export function stackPanelStyles(
  split: number,
  position: 'top' | 'bottom',
  outH = 1920,
): { faceFrac: number; gameFrac: number; faceFirst: boolean } {
  const { faceH, gameH } = stackHeights(split, outH)
  const faceFrac = faceH / outH
  const gameFrac = gameH / outH
  return { faceFrac, gameFrac, faceFirst: position !== 'bottom' }
}

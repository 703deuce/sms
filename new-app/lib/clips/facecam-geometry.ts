import type { CSSProperties } from 'react'
import type { FacecamBox } from '@/lib/clips/edits'
import { stackHeights } from '@/lib/streamer/layout-math'

export { stackHeights }

export const DEFAULT_FACECAM_BOX: FacecamBox = { x: 0.02, y: 0.02, w: 0.32, h: 0.28 }
export const DEFAULT_GAMEPLAY_BOX: FacecamBox = { x: 0, y: 0, w: 1, h: 1 }

/** 9:16 crop window on 16:9 source (full height). */
export function defaultUploadCropBox(): FacecamBox {
  const w = (9 / 16) / (16 / 9)
  return { x: (1 - w) / 2, y: 0, w, h: 1 }
}

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

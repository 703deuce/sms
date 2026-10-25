/** Clips product shell — enabled when building the OpusClip competitor UI. */

export const CLIPS_PRODUCT_HREF = '/app/clips'

export function isClipsProduct(): boolean {
  return process.env.NEXT_PUBLIC_PRODUCT === 'clips'
}

export const CLIPS_PRODUCT_TITLE = 'Clips'

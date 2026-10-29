/** Rick fit_top geometry — parity with worker stream_overlay_layout.py */

import geom from '@/lib/clips/overlay-geometry.json'

const fitTop = geom.fitTop

export const STREAM_PLAY_W = 1080
export const STREAM_PLAY_H = 1920
export const STREAM_HEADLINE_TOP = fitTop.headlineTop

export function headlineBoxHeightPx(lineCount: number, playH = STREAM_PLAY_H): number {
  const lines = Math.max(fitTop.minLines, Math.min(fitTop.maxLines, lineCount || 2))
  const scale = playH / geom.baseH
  const perLine = Math.round(fitTop.perLinePx * scale)
  const pad = Math.round(fitTop.padPx * scale)
  return Math.max(Math.round(fitTop.minBoxPx * scale), lines * perLine + pad)
}

export function streamVideoBandHeightPx(playW = STREAM_PLAY_W): number {
  let h = Math.round((playW * 9) / 16)
  if (h % 2) h -= 1
  return h
}

export type StreamOverlayLayout = {
  playW: number
  playH: number
  topBlurH: number
  headlineTop: number
  headlineH: number
  videoY: number
  videoH: number
  bottomY: number
  bottomH: number
  chatTop: number
  chatH: number
  badgeY: number
}

export function overlayLayout(headlineLineCount: number, playW = STREAM_PLAY_W, playH = STREAM_PLAY_H): StreamOverlayLayout {
  const headlineH = headlineBoxHeightPx(headlineLineCount, playH)
  const videoY = STREAM_HEADLINE_TOP + headlineH
  let videoH = streamVideoBandHeightPx(playW)
  if (videoY + videoH > playH) {
    videoH = Math.max(2, playH - videoY - Math.round((fitTop.videoBottomReservePx * playH) / geom.baseH))
  }
  const bottomY = videoY + videoH
  const bottomH = Math.max(0, playH - bottomY)
  const badgeY = bottomY - Math.round((fitTop.badgeOffsetPx * playH) / geom.baseH)
  return {
    playW,
    playH,
    topBlurH: STREAM_HEADLINE_TOP,
    headlineTop: STREAM_HEADLINE_TOP,
    headlineH,
    videoY,
    videoH,
    bottomY,
    bottomH,
    chatTop: bottomY,
    chatH: bottomH,
    badgeY,
  }
}

/** Rick fit_top geometry — parity with worker stream_overlay_layout.py */

export const STREAM_PLAY_W = 1080
export const STREAM_PLAY_H = 1920
export const STREAM_HEADLINE_TOP = 150

export function headlineBoxHeightPx(lineCount: number, playH = STREAM_PLAY_H): number {
  const lines = Math.max(2, Math.min(4, lineCount || 2))
  const scale = playH / 1920
  const perLine = Math.round(110 * scale)
  const pad = Math.round(40 * scale)
  return Math.max(Math.round(320 * scale), lines * perLine + pad)
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
    videoH = Math.max(2, playH - videoY - Math.round((80 * playH) / 1920))
  }
  const bottomY = videoY + videoH
  const bottomH = Math.max(0, playH - bottomY)
  const badgeY = bottomY - Math.round((40 * playH) / 1920)
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

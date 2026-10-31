/**
 * EP2: badge TEXT as ASS for the editor's libass-wasm layer. The export draws the badge sprite with
 * ffmpeg drawtext (layer_sprites.render_badge_png / clip_export_template); this mirrors its
 * geometry: fontsize = drawtext pixel size, x = text_x, glyph tops at y = (h - fs) // 2.
 * Not byte-shared with the worker (that is EP4: sprite → ASS on both sides).
 */
import geom from '@/lib/clips/overlay-geometry.json'
import { assEmPerFontsize } from '@/lib/clips/caption-fit'

const G = geom as unknown as { baseH?: number; badge?: { fontPx?: number; padXPx?: number; logoPx?: number; gapPx?: number } }
export const BADGE_FONT = 'Montserrat Black'
// Montserrat-Black.ttf (pinned): libass puts the baseline usWinAscent below the \an7 top; caps are 700/1000 em.
const WIN_ASCENT = 1109
const CAP_HEIGHT = 700
const UPEM = 1000

export type BadgeTextInput = {
  rect: { x: number; y: number; w: number; h: number }
  text: string
  showLogo: boolean
  playW: number
  playH: number
}

const pyRound = (x: number) => {
  const r = Math.round(x)
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r
}

export function badgeTextGeometry(b: BadgeTextInput): { x: number; y: number; fontPx: number; text: string } | null {
  const text = b.text.slice(0, 24)
  if (!text) return null
  const s = b.playH / Number(G.baseH || 1920)
  const bg = G.badge ?? {}
  const w = Math.max(8, b.rect.w)
  const h = Math.max(8, b.rect.h)
  const fontPx = Math.max(10, pyRound(Number(bg.fontPx || 32) * s))
  const padX = Math.max(4, pyRound(Number(bg.padXPx || 22) * s))
  const logo = Math.max(8, pyRound(Number(bg.logoPx || 40) * s))
  const gap = Math.max(2, pyRound(Number(bg.gapPx || 12) * s))
  const tx = b.showLogo
    ? padX + logo + gap
    : Math.max(padX, Math.floor((w - [...text].length * Math.trunc(fontPx * 0.62)) / 2))
  const ty = Math.floor((h - fontPx) / 2)
  return { x: b.rect.x + tx, y: b.rect.y + ty, fontPx, text }
}

const esc = (t: string) => t.replace(/\\/g, '\\\\').replace(/\{/g, '(').replace(/\}/g, ')')
const f2 = (x: number) => (Math.round(x * 100) / 100).toString()

/** Standalone .ass (PlayRes = the badge's play space) with one white Montserrat Black event. */
export function badgeTextAss(b: BadgeTextInput, durationMs: number): string | null {
  const g = badgeTextGeometry(b)
  if (!g) return null
  const assFs = g.fontPx / assEmPerFontsize(BADGE_FONT)
  const em = g.fontPx
  const top = g.y - ((WIN_ASCENT - CAP_HEIGHT) / UPEM) * em
  const cs = Math.floor(Math.max(1, durationMs) / 10)
  const end = `${Math.floor(cs / 360000)}:${String(Math.floor((cs % 360000) / 6000)).padStart(2, '0')}:${String(Math.floor((cs % 6000) / 100)).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`
  return (
    `[Script Info]\nScriptType: v4.00+\nPlayResX: ${b.playW}\nPlayResY: ${b.playH}\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n` +
    '[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n' +
    `Style: BadgeText,${BADGE_FONT},${f2(assFs)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1\n\n` +
    '[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n' +
    `Dialogue: 10,0:00:00.00,${end},BadgeText,,0,0,0,,{\\an7\\pos(${f2(g.x)},${f2(top)})}${esc(g.text)}\n`
  )
}

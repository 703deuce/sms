/**
 * G3b: read what the text burn needs from an uploaded TTF / OTF — no dependencies, pure bytes, so
 * it runs in the upload route and in tests. Family = name ID 1 (what libass / JASSUB match the ASS
 * Fontname against); metrics = the caption-fit row shape ({unitsPerEm, defaultAdv,
 * assEmPerFontsize, adv}) the worker (caption_fit.register_font_metrics) and the preview
 * (caption-fit.registerFontMetrics) use to size and wrap text. assEmPerFontsize is libass's
 * em / (usWinAscent + usWinDescent) — the same value the bundled-font table holds.
 */
export type FontMetricsRow = { unitsPerEm: number; defaultAdv: number; assEmPerFontsize: number; adv: Record<string, number> }
export type ParsedFont = { family: string; format: 'ttf' | 'otf'; metrics: FontMetricsRow }

export const FONT_MAX_BYTES = 8 * 1024 * 1024
/** Advances kept for Latin (incl. Latin Extended-A/B) — what caption wrapping measures. */
const ADV_MAX_CP = 0x24f

export class FontParseError extends Error {}

function tables(v: DataView): Map<string, { off: number; len: number }> {
  const tag = v.getUint32(0)
  if (tag === 0x774f4646 || tag === 0x774f4632) throw new FontParseError('WOFF fonts are not supported — upload the .ttf or .otf')
  if (tag === 0x74746366) throw new FontParseError('Font collections (.ttc) are not supported — upload a single .ttf or .otf')
  if (tag !== 0x00010000 && tag !== 0x4f54544f && tag !== 0x74727565) throw new FontParseError('Not a TrueType / OpenType font')
  const n = v.getUint16(4)
  const out = new Map<string, { off: number; len: number }>()
  for (let i = 0; i < n; i++) {
    const p = 12 + i * 16
    const t = String.fromCharCode(v.getUint8(p), v.getUint8(p + 1), v.getUint8(p + 2), v.getUint8(p + 3))
    const off = v.getUint32(p + 8)
    const len = v.getUint32(p + 12)
    if (off + len > v.byteLength) throw new FontParseError('Font file is truncated')
    out.set(t, { off, len })
  }
  return out
}

function utf16be(v: DataView, off: number, len: number): string {
  let s = ''
  for (let k = 0; k + 1 < len; k += 2) s += String.fromCharCode(v.getUint16(off + k))
  return s
}

function latin1(v: DataView, off: number, len: number): string {
  let s = ''
  for (let k = 0; k < len; k++) s += String.fromCharCode(v.getUint8(off + k))
  return s
}

function familyName(v: DataView, t: { off: number }): string {
  const count = v.getUint16(t.off + 2)
  const strOff = t.off + v.getUint16(t.off + 4)
  let best: { score: number; name: string } | null = null
  for (let i = 0; i < count; i++) {
    const r = t.off + 6 + i * 12
    const [plat, enc, lang, id, len, off] = [v.getUint16(r), v.getUint16(r + 2), v.getUint16(r + 4), v.getUint16(r + 6), v.getUint16(r + 8), v.getUint16(r + 10)]
    if (id !== 1) continue
    const unicode = plat === 0 || (plat === 3 && (enc === 1 || enc === 10))
    const name = (unicode ? utf16be(v, strOff + off, len) : plat === 1 && enc === 0 ? latin1(v, strOff + off, len) : '').trim()
    if (!name) continue
    const score = plat === 3 && lang === 0x409 ? 3 : plat === 3 ? 2 : plat === 0 ? 1 : 0
    if (!best || score > best.score) best = { score, name }
  }
  if (!best) throw new FontParseError('The font has no family name')
  return best.name
}

/** codepoint → glyph id for cp ≤ ADV_MAX_CP (cmap format 4 or 12, Unicode subtable). */
function cmapLatin(v: DataView, t: { off: number }): Map<number, number> {
  const n = v.getUint16(t.off + 2)
  let pick: { off: number; rank: number } | null = null
  for (let i = 0; i < n; i++) {
    const r = t.off + 4 + i * 8
    const [plat, enc] = [v.getUint16(r), v.getUint16(r + 2)]
    const off = t.off + v.getUint32(r + 4)
    const fmt = v.getUint16(off)
    if (fmt !== 4 && fmt !== 12) continue
    const rank = (plat === 3 && enc === 10) || (plat === 0 && fmt === 12) ? 3 : (plat === 3 && enc === 1) || plat === 0 ? 2 : 0
    if (rank && (!pick || rank > pick.rank)) pick = { off, rank }
  }
  const out = new Map<number, number>()
  if (!pick) return out
  const o = pick.off
  if (v.getUint16(o) === 12) {
    const groups = v.getUint32(o + 12)
    for (let g = 0; g < groups; g++) {
      const p = o + 16 + g * 12
      const [a, b, gid] = [v.getUint32(p), v.getUint32(p + 4), v.getUint32(p + 8)]
      for (let c = a; c <= Math.min(b, ADV_MAX_CP); c++) out.set(c, gid + (c - a))
    }
    return out
  }
  const segX2 = v.getUint16(o + 6)
  const ends = o + 14
  const starts = ends + segX2 + 2
  const deltas = starts + segX2
  const ranges = deltas + segX2
  for (let s = 0; s < segX2 / 2; s++) {
    const end = v.getUint16(ends + s * 2)
    const start = v.getUint16(starts + s * 2)
    const delta = v.getInt16(deltas + s * 2)
    const roAt = ranges + s * 2
    const ro = v.getUint16(roAt)
    for (let c = start; c <= Math.min(end, ADV_MAX_CP); c++) {
      if (c === 0xffff) break
      let gid: number
      if (ro === 0) gid = (c + delta) & 0xffff
      else {
        const gp = roAt + ro + (c - start) * 2
        if (gp + 2 > v.byteLength) continue
        gid = v.getUint16(gp)
        if (gid) gid = (gid + delta) & 0xffff
      }
      if (gid) out.set(c, gid)
    }
  }
  return out
}

export function parseFont(bytes: Uint8Array): ParsedFont {
  if (bytes.byteLength < 12) throw new FontParseError('Not a TrueType / OpenType font')
  if (bytes.byteLength > FONT_MAX_BYTES) throw new FontParseError('Font file is over 8 MB')
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  try {
    const tb = tables(v)
    const need = (t: string) => {
      const x = tb.get(t)
      if (!x) throw new FontParseError(`The font is missing its ${t} table`)
      return x
    }
    const head = need('head')
    const hhea = need('hhea')
    const hmtx = need('hmtx')
    const os2 = need('OS/2')
    const upm = v.getUint16(head.off + 18)
    const nH = v.getUint16(hhea.off + 34)
    const winAsc = v.getUint16(os2.off + 74)
    const winDesc = v.getUint16(os2.off + 76)
    if (!upm || !nH || winAsc + winDesc <= 0) throw new FontParseError('The font has invalid metrics')
    const advOf = (gid: number) => v.getUint16(hmtx.off + Math.min(gid, nH - 1) * 4)
    const cmap = cmapLatin(v, need('cmap'))
    const adv: Record<string, number> = {}
    for (const [cp, gid] of [...cmap.entries()].sort((a, b) => a[0] - b[0])) adv[String(cp)] = advOf(gid)
    const printable = Array.from({ length: 95 }, (_, k) => adv[String(32 + k)]).filter((x): x is number => x !== undefined)
    if (!printable.length) throw new FontParseError('The font has no Latin characters')
    const defaultAdv = Math.round(printable.reduce((a, b) => a + b, 0) / printable.length)
    const family = familyName(v, need('name'))
    return {
      family,
      format: v.getUint32(0) === 0x4f54544f ? 'otf' : 'ttf',
      metrics: { unitsPerEm: upm, defaultAdv, assEmPerFontsize: Math.round((upm / (winAsc + winDesc)) * 1e6) / 1e6, adv },
    }
  } catch (e) {
    if (e instanceof FontParseError) throw e
    throw new FontParseError('Could not read the font file')
  }
}

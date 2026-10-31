/**
 * G3b: leaf helpers shared by the text model (editor/text-items.ts) and the ASS builder
 * (text-items-ass.ts) — no imports, so the model never pulls in the builder. Mirrors
 * worker/clips_worker/text_items.py (user_font_id / safe_family / norm_marks).
 */
type Dict = Record<string, unknown>
const isDict = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v)

export const MAX_MARKS = 50
const BAD_FAMILY = new Set([',', '{', '}', '\\', '\r', '\n', '\t'])

/** G3b: `user:<id>` → id of a workspace font (clip_fonts row), else null (py user_font_id). */
export function userFontId(font: unknown): string | null {
  const f = String(font ?? '')
  if (!f.startsWith('user:')) return null
  const id = f.slice(5)
  return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : null
}

/** ASS-safe family name (py safe_family). */
export function safeFamily(v: unknown): string {
  const s = Array.from(String(v ?? '')).filter((c) => !BAD_FAMILY.has(c)).join('').trim()
  return Array.from(s).slice(0, 64).join('')
}

export type TextMark = { s: number; e: number; b?: true; i?: true }

const intPy = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.trunc(v) : null
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'string' && /^\s*[+-]?\d+\s*$/.test(v)) return Number(v.trim())
  return null
}

/** G3b: bold / italic ranges in code points of item.text (py norm_marks). */
export function normMarks(raw: unknown, n: number): TextMark[] {
  const out: TextMark[] = []
  for (const m of Array.isArray(raw) ? raw : []) {
    if (!isDict(m) || !(m.b === true || m.i === true)) continue
    let s0 = intPy(m.s)
    let e0 = intPy(m.e)
    if (s0 === null || e0 === null) continue
    s0 = Math.max(0, s0)
    e0 = Math.min(n, e0)
    if (e0 <= s0) continue
    out.push({ s: s0, e: e0, ...(m.b === true ? { b: true as const } : {}), ...(m.i === true ? { i: true as const } : {}) })
    if (out.length >= MAX_MARKS) break
  }
  return out
}

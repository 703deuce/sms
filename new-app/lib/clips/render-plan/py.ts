/**
 * EP1: Python-compatible number formatting so the TS ASS builders emit the worker's ASS byte for
 * byte. Python `round()` is round-half-even on the exact binary value, `f"{x:.2f}"` likewise, and
 * `str(float)` always has a decimal point ("8.0"). JS Math.round / toFixed differ on exact ties.
 */

const bigPow = (b: bigint, e: number): bigint => {
  let r = BigInt(1)
  for (let i = 0; i < e; i++) r *= b
  return r
}

/** Exact decimal expansion of a finite double (no exponent), e.g. 0.125 → "0.125". */
export function exactDecimal(x: number): string {
  if (!Number.isFinite(x)) throw new Error(`non-finite ${x}`)
  if (Number.isInteger(x)) return BigInt(x).toString()
  const neg = x < 0
  const buf = new DataView(new ArrayBuffer(8))
  buf.setFloat64(0, Math.abs(x))
  const hi = buf.getUint32(0)
  const lo = buf.getUint32(4)
  const expBits = (hi >>> 20) & 0x7ff
  let mant = (BigInt(hi & 0xfffff) << BigInt(32)) | BigInt(lo)
  let e: number
  if (expBits === 0) e = -1074
  else {
    mant |= BigInt(1) << BigInt(52)
    e = expBits - 1075
  }
  // value = mant * 2^e, e < 0 here (non-integers)
  const k = -e
  const digits = (mant * bigPow(BigInt(5), k)).toString().padStart(k + 1, '0')
  const intPart = digits.slice(0, digits.length - k) || '0'
  const frac = digits.slice(digits.length - k).replace(/0+$/, '')
  return `${neg ? '-' : ''}${intPart}${frac ? `.${frac}` : ''}`
}

function roundDecimalString(s: string, nd: number): string {
  const neg = s.startsWith('-')
  const abs = neg ? s.slice(1) : s
  const [ip, fp = ''] = abs.split('.')
  const padded = (fp + '0'.repeat(nd + 1)).slice(0, Math.max(fp.length, nd + 1))
  const keep = padded.slice(0, nd)
  const rest = padded.slice(nd)
  let digits = BigInt((ip || '0') + keep)
  const first = rest.charCodeAt(0) - 48
  const tail = rest.slice(1).replace(/0+$/, '')
  const roundUp = first > 5 || (first === 5 && (tail.length > 0 || digits % BigInt(2) === BigInt(1)))
  if (roundUp) digits += BigInt(1)
  let out = digits.toString().padStart(nd + 1, '0')
  if (nd > 0) out = `${out.slice(0, out.length - nd)}.${out.slice(out.length - nd)}`
  const isZero = /^[0.]*$/.test(out)
  return `${neg && !isZero ? '-' : ''}${out}`
}

/** Python `f"{x:.{nd}f}"`. */
export function pyFixed(x: number, nd: number): string {
  return roundDecimalString(exactDecimal(x), nd)
}

/** Python `f"{x:0{width}.{nd}f}"` for non-negative x. */
export function pyFixedPad(x: number, width: number, nd: number): string {
  return pyFixed(x, nd).padStart(width, '0')
}

/** Python `round(x)` → int (half-even). */
export function pyRound(x: number): number {
  return Number(roundDecimalString(exactDecimal(x), 0))
}

/** Python `round(x, nd)` → float (correctly rounded, half-even on the exact value). */
export function pyRoundN(x: number, nd: number): number {
  const r = Number(roundDecimalString(exactDecimal(x), nd))
  return r === 0 && (x < 0 || Object.is(x, -0)) ? -0 : r
}

/** Python `int(x)` (truncate toward zero). */
export function pyInt(x: number): number {
  return Math.trunc(x)
}

/** Python `str(float)` for the magnitudes ASS uses (no exponent form). */
export function pyFloatStr(x: number): string {
  if (Object.is(x, -0)) return '-0.0'
  if (Number.isInteger(x)) return `${x}.0`
  return String(x)
}

/** Python floor division / modulo for ints. */
export function pyDivmod(a: number, b: number): [number, number] {
  const q = Math.floor(a / b)
  return [q, a - q * b]
}

/** Python `"%02X" % n`. */
export function hex2(n: number): string {
  return n.toString(16).toUpperCase().padStart(2, '0')
}

/** Python truthiness-or for numbers/strings coming from JSON (`x or default`). */
export function pyOr<T>(v: unknown, d: T): T | unknown {
  if (v === undefined || v === null || v === false || v === 0 || v === '' || (Array.isArray(v) && v.length === 0)) return d
  return v
}

/** Python `float(v)` for JSON numbers / numeric strings. */
export function pyFloat(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  const n = Number(String(v).trim())
  if (!Number.isFinite(n) && !/^[-+]?(inf|infinity|nan)$/i.test(String(v).trim())) throw new Error(`float(${String(v)})`)
  return n
}

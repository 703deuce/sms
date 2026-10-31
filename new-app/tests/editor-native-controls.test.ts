import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const EDITOR_DIR = path.join(process.cwd(), 'components/clips/editor')

/**
 * Native range inputs that are allowed on purpose (keyed by data-testid). E1 timeline zoom uses a
 * plain <input type="range"> like CapCut's zoom slider; it is keyboard/ARIA labelled and covered by
 * tests/timeline-zoom-render.test.tsx.
 */
const ALLOWED_RANGE_TESTIDS = new Set(['timeline-zoom-slider'])

function walkTsx(dir: string): string[] {
  const out: string[] = []
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) out.push(...walkTsx(p))
    else if (name.endsWith('.tsx')) out.push(p)
  }
  return out
}

/** Each `<input ...>` JSX element's attribute text (up to its closing `>` / `/>`). */
function inputElements(src: string): string[] {
  const out: string[] = []
  const re = /<input\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    let depth = 0
    let i = m.index + 6
    for (; i < src.length; i++) {
      const c = src[i]
      if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth === 0) break
    }
    out.push(src.slice(m.index, i + 1))
  }
  return out
}

function disallowedRange(src: string): boolean {
  return inputElements(src).some((el) => {
    if (!/type=["']range["']/.test(el)) return false
    const id = /data-testid=["']([^"']+)["']/.exec(el)?.[1]
    return !id || !ALLOWED_RANGE_TESTIDS.has(id)
  })
}

describe('§13 editor native control audit', () => {
  it('no native select or (non-allowlisted) range inputs under components/clips/editor', () => {
    const files = walkTsx(EDITOR_DIR)
    const offenders: string[] = []
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8')
      if (/<select\b/.test(src) || disallowedRange(src)) {
        offenders.push(path.relative(process.cwd(), file))
      }
    }
    expect(offenders).toEqual([])
  })

  it('still flags a range input that is not allowlisted', () => {
    expect(disallowedRange('<input type="range" min={0} max={1} onChange={(e) => f(e.target.value > 0)} />')).toBe(true)
    expect(disallowedRange('<input type="range" data-testid="timeline-zoom-slider" value={1} />')).toBe(false)
    expect(disallowedRange('<input type="text" />')).toBe(false)
  })
})

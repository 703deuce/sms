import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const EDITOR_DIR = path.join(process.cwd(), 'components/clips/editor')

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

describe('§13 editor native control audit', () => {
  it('no native select or range inputs under components/clips/editor', () => {
    const files = walkTsx(EDITOR_DIR)
    const offenders: string[] = []
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8')
      if (/<select\b/.test(src) || /type=["']range["']/.test(src)) {
        offenders.push(path.relative(process.cwd(), file))
      }
    }
    expect(offenders).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(__dirname, '..')
const SKIP = new Set(['node_modules', '.next', '.turbo', 'coverage', 'playwright-report', 'test-results'])
const SELF = 'tests/ef24-no-rvm-in-web.test.ts'
const EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json)$/
const BAD = [
  /robust\s*video\s*matting/i,
  /PeterL1n/i,
  /rvm_(mobilenetv3|resnet50)/i,
  /\.(pth|onnx)['"`]/i,
  /(import|require|fetch)\s*\(?[^\n]*\brvm\b/i,
  /from\s+['"][^'"]*\brvm\b[^'"]*['"]/i,
]

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (EXT.test(name)) out.push(p)
  }
}

describe('EF-24: RVM never ships in the web app', () => {
  it('no file under new-app/ imports or fetches RVM code or weights', () => {
    const files: string[] = []
    walk(ROOT, files)
    const hits = files
      .filter((f) => relative(ROOT, f) !== SELF)
      .flatMap((f) => {
        const src = readFileSync(f, 'utf8')
        return BAD.filter((re) => re.test(src)).map((re) => `${relative(ROOT, f)} ~ ${re}`)
      })
    expect(hits).toEqual([])
  })

  it('package.json has no matting dependency', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
    expect(deps.filter((d) => /rvm|matting|onnxruntime-web/i.test(d))).toEqual([])
  })
})

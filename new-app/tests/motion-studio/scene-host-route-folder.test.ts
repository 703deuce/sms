import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// Next.js App Router treats folders starting with "_" as private and never routes them.
// The scene host lived in app/api/motion-studio/_scene, so every signed scene URL
// (/api/motion-studio/_scene/...) returned the Next 404 page and live playback never
// started. A literal "_" URL segment must use the %5F folder escape.
function routeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? routeFiles(p) : e.name === 'route.ts' ? [p] : []
  })
}

describe('scene host route folder', () => {
  const root = path.join(__dirname, '../../app/api/motion-studio')
  it('serves /api/motion-studio/_scene/... from a routable %5Fscene folder', () => {
    expect(fs.existsSync(path.join(root, '%5Fscene'))).toBe(true)
    expect(fs.existsSync(path.join(root, '_scene'))).toBe(false)
  })
  it('has no Motion Studio API route hidden inside a private (_) folder', () => {
    const hidden = routeFiles(root).filter((f) => path.relative(root, f).split(path.sep).some((s) => s.startsWith('_')))
    expect(hidden).toEqual([])
  })
})

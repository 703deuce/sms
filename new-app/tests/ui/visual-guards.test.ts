import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..', '..')

function walkTsx(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (name === 'node_modules' || name === '.next') continue
    const st = statSync(p)
    if (st.isDirectory()) walkTsx(p, out)
    else if (p.endsWith('.tsx')) out.push(p)
  }
  return out
}

describe('visual guards', () => {
  it('PrimaryButton has no gradient', () => {
    const s = readFileSync(join(ROOT, 'components/app/primary-button.tsx'), 'utf8')
    expect(s).not.toContain('bg-brand-gradient')
  })
  it('bg-brand-gradient only in logo-mark', () => {
    const hits: string[] = []
    for (const f of walkTsx(join(ROOT, 'components'))) {
      const t = readFileSync(f, 'utf8')
      if (t.includes('bg-brand-gradient')) hits.push(f.replace(`${ROOT}/`, ''))
    }
    expect(hits.sort()).toEqual(['components/brand/logo-mark.tsx'])
  })
  it('globals lucide stroke', () => {
    const css = readFileSync(join(ROOT, 'app/globals.css'), 'utf8')
    expect(css).toContain('.lucide')
    expect(css).toContain('stroke-width: 1.75')
  })
  it('PageContainer width', () => {
    const s = readFileSync(join(ROOT, 'components/app/page-primitives.tsx'), 'utf8')
    expect(s).toContain('max-w-screen-2xl')
    expect(s).toContain('px-6')
    expect(s).not.toContain('max-w-[1400px]')
  })
  it('drive-home no 1188 card', () => {
    const s = readFileSync(join(ROOT, 'components/drive/drive-home.tsx'), 'utf8')
    expect(s).not.toContain('max-w-[1188px]')
  })
  it('templates-hub no max-w-6xl', () => {
    const s = readFileSync(join(ROOT, 'components/clips/templates/templates-hub.tsx'), 'utf8')
    expect(s).not.toContain('max-w-6xl')
  })
  it('breadcrumbs clipsProjectId', () => {
    const s = readFileSync(join(ROOT, 'components/shell/app-breadcrumbs.tsx'), 'utf8')
    expect(s).toContain('clipsProjectId')
  })
  it('new project settings scroll', () => {
    const s = readFileSync(join(ROOT, 'components/clips/new-project-workspace.tsx'), 'utf8')
    expect(s).toContain('overflow-y-auto')
    expect(s).toContain('lg:max-h-[calc(100dvh-5.5rem)]')
  })
  it('project page open=editor gate', () => {
    const s = readFileSync(join(ROOT, 'app/app/clips/[projectId]/page.tsx'), 'utf8')
    expect(s).toContain("open === 'editor'")
  })
  it('no dollar UI copy in components', () => {
    for (const f of walkTsx(join(ROOT, 'components'))) {
      const t = readFileSync(f, 'utf8')
      const stripped = t.replace(/`[^`]*\$\{[^}]*\}[^`]*`/g, '')
      expect(stripped, f).not.toMatch(/(?<!\$)\$\d/)
    }
  })
})

describe('editor chrome text floor (UI_fix2)', () => {
  function walkEditor(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (name === 'node_modules') continue
      const st = statSync(p)
      if (st.isDirectory()) walkEditor(p, out)
      else if (/\.tsx?$/.test(name)) out.push(p)
    }
    return out
  }

  it('no sub-11px arbitrary text classes in editor chrome paths', () => {
    const roots = [join(ROOT, 'components/clips/editor')]
    const bad = /text-\[(6|7|8|9|10)px\]/
    for (const root of roots) {
      for (const f of walkEditor(root)) {
        const rel = f.replace(`${ROOT}/`, '')
        const t = readFileSync(f, 'utf8')
        expect(t, rel).not.toMatch(bad)
      }
    }
  })
})

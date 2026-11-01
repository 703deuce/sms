import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { useEditorWords } from '@/components/clips/editor/use-editor-words'

describe('editor-shell useEditorWords wiring', () => {
  it('exports useEditorWords hook', () => {
    expect(typeof useEditorWords).toBe('function')
  })

  it('editor-shell.tsx imports useEditorWords (runtime ReferenceError guard)', () => {
    const src = readFileSync(join(process.cwd(), 'components/clips/editor/editor-shell.tsx'), 'utf8')
    expect(src).toMatch(
      /import\s*\{[^}]*\buseEditorWords\b[^}]*\}\s*from\s*['"]@\/components\/clips\/editor\/use-editor-words['"]/,
    )
    expect(src).toMatch(
      /import\s*\{[^}]*\bSHOW_SURROUNDING_CONTEXT_MS\b[^}]*\}\s*from\s*['"]@\/lib\/clips\/trim-bounds['"]/,
    )
  })

  it('editor-shell.tsx imports keepSegments (runtime ReferenceError guard)', () => {
    const src = readFileSync(join(process.cwd(), 'components/clips/editor/editor-shell.tsx'), 'utf8')
    expect(src).toMatch(
      /import\s*\{[^}]*\bkeepSegments\b[^}]*\}\s*from\s*['"]@\/lib\/clips\/edits['"]/,
    )
  })
})

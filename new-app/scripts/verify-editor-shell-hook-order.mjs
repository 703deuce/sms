#!/usr/bin/env node
/**
 * Static guard: hooks declared above `const editorWords` must not reference `editorWords`
 * in their dependency array (evaluated during render → TDZ → SSR 500).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const shellPath = join(here, '..', 'components', 'clips', 'editor', 'editor-shell.tsx')
const src = readFileSync(shellPath, 'utf8')
const lines = src.split('\n')
const editorWordsLine = lines.findIndex((l) => /\bconst editorWords\b/.test(l))
if (editorWordsLine < 0) {
  console.error('verify-editor-shell-hook-order: const editorWords not found')
  process.exit(1)
}

const hookRe = /\buse(?:Callback|Memo|Effect)\s*\(/
const depRe = /\[([^\]]*editorWords[^\]]*)\]/

for (let i = 0; i < editorWordsLine; i++) {
  if (!hookRe.test(lines[i] ?? '')) continue
  const chunk = lines.slice(i, Math.min(i + 25, editorWordsLine)).join('\n')
  if (/\beditorWords\b/.test(chunk) && depRe.test(chunk)) {
    console.error(
      `verify-editor-shell-hook-order: editorWords referenced in hook deps before line ${editorWordsLine + 1} (near line ${i + 1})`,
    )
    process.exit(1)
  }
}

console.log('verify-editor-shell-hook-order: OK')

/**
 * Guard against runtime ReferenceError in clip editor shell (useEditorWords, keepSegments, …).
 * Vitest runs this via editor-shell-use-editor-words.test.ts patterns; CI runs the script directly.
 */
import fs from 'node:fs'
import path from 'node:path'

const shellPath = path.join(process.cwd(), 'components/clips/editor/editor-shell.tsx')
const src = fs.readFileSync(shellPath, 'utf8')

const required = [
  {
    name: 'useEditorWords',
    re: /import\s*\{[^}]*\buseEditorWords\b[^}]*\}\s*from\s*['"]@\/components\/clips\/editor\/use-editor-words['"]/,
  },
  {
    name: 'SHOW_SURROUNDING_CONTEXT_MS',
    re: /import\s*\{[^}]*\bSHOW_SURROUNDING_CONTEXT_MS\b[^}]*\}\s*from\s*['"]@\/lib\/clips\/trim-bounds['"]/,
  },
  {
    name: 'keepSegments',
    re: /import\s*\{[^}]*\bkeepSegments\b[^}]*\}\s*from\s*['"]@\/lib\/clips\/edits['"]/,
  },
]

let failed = false
for (const { name, re } of required) {
  if (!re.test(src)) {
    console.error(`[verify-editor-shell-import] missing import for ${name} in editor-shell.tsx`)
    failed = true
  }
}

if (failed) process.exit(1)
console.log('[verify-editor-shell-import] ok')

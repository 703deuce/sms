/**
 * Guard against runtime ReferenceError in clip editor shell (missing hook / symbol imports).
 * CI: pnpm run verify:editor-shell-import
 */
import fs from 'node:fs'
import path from 'node:path'

const REACT_HOOKS = new Set([
  'useCallback',
  'useContext',
  'useDebugValue',
  'useEffect',
  'useId',
  'useImperativeHandle',
  'useLayoutEffect',
  'useMemo',
  'useReducer',
  'useRef',
  'useState',
  'useSyncExternalStore',
])

const shellPath = path.join(process.cwd(), 'components/clips/editor/editor-shell.tsx')
let src = fs.readFileSync(shellPath, 'utf8')
src = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const importRe =
  /import\s+(?:type\s+)?(?:\{([^}]+)\}|([A-Za-z0-9_$]+))\s+from\s+['"][^'"]+['"]/g
const imported = new Set()
let m
while ((m = importRe.exec(src)) !== null) {
  const names = m[2]
    ? [m[2]]
    : m[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim())
  for (const n of names) imported.add(n)
}

const localHooks = new Set()
const localHookRe = /(?:export\s+)?function\s+(use[A-Z][a-zA-Z0-9]*)\s*(?:<[^>]*>)?\s*\(/g
while ((m = localHookRe.exec(src)) !== null) localHooks.add(m[1])

const requiredStatic = [
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
for (const { name, re } of requiredStatic) {
  if (!re.test(src)) {
    console.error(`[verify-editor-shell-import] missing import for ${name} in editor-shell.tsx`)
    failed = true
  }
}

const hookCallRe = /\b(use[A-Z][a-zA-Z0-9]*)\s*(?:<[^>]*>)?\s*\(/g
const called = new Set()
while ((m = hookCallRe.exec(src)) !== null) {
  const name = m[1]
  if (REACT_HOOKS.has(name)) continue
  called.add(name)
}

for (const name of called) {
  if (localHooks.has(name)) continue
  if (!imported.has(name)) {
    console.error(`[verify-editor-shell-import] ${name} is called but not imported in editor-shell.tsx`)
    failed = true
  }
}

if (failed) process.exit(1)
console.log('[verify-editor-shell-import] ok')

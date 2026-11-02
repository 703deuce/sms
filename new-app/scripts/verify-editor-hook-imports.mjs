/**
 * Catch custom hooks used without import across components/clips/editor (ReferenceError at runtime).
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

const ROOT = path.join(process.cwd(), 'components/clips/editor')

function walk(dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules') continue
      walk(full, out)
    } else if (/\.tsx$/.test(ent.name)) out.push(full)
  }
}

function checkFile(file) {
  let text = fs.readFileSync(file, 'utf8')
  text = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const imported = new Set()
  const importRe =
    /import\s+(?:type\s+)?(?:\{([^}]+)\}|([A-Za-z0-9_$]+))\s+from\s+['"][^'"]+['"]/g
  let m
  while ((m = importRe.exec(text)) !== null) {
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
  while ((m = localHookRe.exec(text)) !== null) localHooks.add(m[1])

  const hookCallRe = /\b(use[A-Z][a-zA-Z0-9]*)\s*(?:<[^>]*>)?\s*\(/g
  const missing = new Set()
  while ((m = hookCallRe.exec(text)) !== null) {
    const name = m[1]
    if (REACT_HOOKS.has(name)) continue
    if (localHooks.has(name)) continue
    if (!imported.has(name)) missing.add(name)
  }
  return [...missing]
}

let failed = false
const files = []
walk(ROOT, files)
for (const file of files) {
  const missing = checkFile(file)
  for (const name of missing) {
    console.error(
      `[verify-editor-hook-imports] ${name} used but not imported in ${path.relative(process.cwd(), file)}`,
    )
    failed = true
  }
}

if (failed) process.exit(1)
console.log('[verify-editor-hook-imports] ok')

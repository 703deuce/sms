/**
 * Catch runtime ReferenceError from JSX components used without an import (e.g. FreeToolBadge).
 * Scoped to clip editor + script side panels. Skips same-file components and DOM/utility false positives.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOTS = ['components/clips/editor', 'components/script-editor/side']
/** App chrome: undefined JSX tags crash every /app route at runtime; tsc may not fail on Turbopack builds. */
const APP_CHROME_ROOTS = ['components/shell']
const APP_CHROME_FILES = ['components/ui/sidebar.tsx']

const SKIP_TAGS = new Set(['Fragment', 'Suspense', 'React', 'T', 'PropertiesTab', 'TranscriptSelection', 'Filter', 'ClipGapToolSettings'])

function walk(dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules') continue
      walk(full, out)
    } else if (/\.tsx$/.test(ent.name)) out.push(full)
  }
}

function localDefs(text) {
  const defs = new Set()
  const patterns = [
    /export\s+function\s+([A-Z][A-Za-z0-9]*)\s*[<(]/g,
    /function\s+([A-Z][A-Za-z0-9]*)\s*[<(]/g,
    /export\s+const\s+([A-Z][A-Za-z0-9]*)\s*=/g,
    /const\s+([A-Z][A-Za-z0-9]*)\s*=\s*(?:function|\()/g,
    /const\s+([A-Z][A-Za-z0-9]*)\s*=/g,
  ]
  for (const re of patterns) {
    let m
    while ((m = re.exec(text)) !== null) defs.add(m[1])
  }
  return defs
}

const importRe =
  /import\s+(?:type\s+)?(?:\{([^}]+)\}|([A-Za-z0-9_$]+))\s+from\s+['"][^'"]+['"]/g
const jsxTagRe = /<([A-Z][A-Za-z0-9]*)(?=[\s/>])/g

let failed = false
function checkFile(file, { panelScoped }) {
  const rel = path.relative(process.cwd(), file)
  if (panelScoped) {
    const panelOk =
      rel.startsWith('components/script-editor/side/') ||
      /components\/clips\/editor\/[^/]+-panel\.tsx$/.test(rel) ||
      rel.includes('clip-shorten-gaps-panel.tsx')
    if (!panelOk) return
  }
  let text = fs.readFileSync(file, 'utf8')
  text = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const imported = new Set()
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
  const local = localDefs(text)
  const used = new Set()
  while ((m = jsxTagRe.exec(text)) !== null) {
    const tag = m[1]
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 24)
    if (/^\s*[|,]/.test(after)) continue
    if (/^\s*>/.test(after)) continue
    if (SKIP_TAGS.has(tag)) continue
    if (tag.startsWith('HTML')) continue
    used.add(tag)
  }
  for (const tag of used) {
    if (local.has(tag)) continue
    if (!imported.has(tag)) {
      console.error(
        `[verify-editor-jsx-imports] ${tag} used in JSX but not imported in ${rel}`,
      )
      failed = true
    }
  }
}

for (const root of ROOTS) {
  const abs = path.join(process.cwd(), root)
  if (!fs.existsSync(abs)) continue
  const files = []
  walk(abs, files)
  for (const file of files) checkFile(file, { panelScoped: true })
}

for (const root of APP_CHROME_ROOTS) {
  const abs = path.join(process.cwd(), root)
  if (!fs.existsSync(abs)) continue
  const files = []
  walk(abs, files)
  for (const file of files) checkFile(file, { panelScoped: false })
}

for (const rel of APP_CHROME_FILES) {
  const file = path.join(process.cwd(), rel)
  if (fs.existsSync(file)) checkFile(file, { panelScoped: false })
}

if (failed) process.exit(1)
console.log('[verify-editor-jsx-imports] ok')

/**
 * Ensures client /api/clips/... fetch paths match app/api route files.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const appApi = path.join(root, 'app', 'api', 'clips')
const editorDir = path.join(root, 'components', 'clips', 'editor')

function routeExists(apiPath) {
  const segments = apiPath.replace(/^\/api\/clips\/?/, '').split('/').filter(Boolean)
  let dir = appApi
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const dynamic = dir.replace(/\\/g, '/').includes('[id]') ? null : null
    const direct = path.join(dir, seg)
    const dyn = path.join(dir, `[${seg === 'clips' && segments[i + 1] ? 'id' : seg.replace(/^clip_/, 'id')}]`)
    if (fs.existsSync(path.join(direct, 'route.ts'))) {
      dir = direct
      continue
    }
    if (fs.existsSync(path.join(dir, '[id]', 'route.ts')) && seg.startsWith('clip_')) {
      dir = path.join(dir, '[id]')
      continue
    }
    const dynId = path.join(dir, '[id]')
    if (fs.existsSync(path.join(dynId, seg, 'route.ts'))) {
      dir = path.join(dynId, seg)
      continue
    }
    if (fs.existsSync(path.join(dir, `[id]`, seg, 'route.ts'))) {
      dir = path.join(dir, '[id]', seg)
      continue
    }
    return { ok: false, missing: path.join(dir, seg, 'route.ts') }
  }
  return fs.existsSync(path.join(dir, 'route.ts')) ? { ok: true } : { ok: false, missing: path.join(dir, 'route.ts') }
}

function resolveClipApiRoute(apiPath) {
  // /api/clips/clips/:id/export-xml → app/api/clips/clips/[id]/export-xml/route.ts
  const rel = apiPath.replace(/^\/api\/clips\//, '')
  const file = path.join(appApi, ...rel.split('/').map((p) => (p.startsWith('clip_') ? '[id]' : p)), 'route.ts')
  if (fs.existsSync(file)) return { ok: true, file }
  return { ok: false, file }
}

const REQUIRED = [
  '/api/clips/clips/clip_x/export-xml',
  '/api/clips/clips/clip_x/export',
  '/api/clips/renders/rend_x',
]

const errors = []
for (const p of REQUIRED) {
  const r = resolveClipApiRoute(p)
  if (!r.ok) errors.push(`${p} → missing ${r.file}`)
}

const exportDialog = fs.readFileSync(path.join(editorDir, 'export-dialog.tsx'), 'utf8')
const hrefMatch = exportDialog.match(/href=\{[`'"]\/api\/clips\/[^`'"]+export-xml[`'"]\}/)
if (!hrefMatch || !hrefMatch[0].includes('/api/clips/clips/${clipId}/export-xml')) {
  errors.push('export-dialog NLE href must use /api/clips/clips/${clipId}/export-xml')
}

if (errors.length) {
  console.error('verify-clip-editor-api-paths failed:\n' + errors.map((e) => `  - ${e}`).join('\n'))
  process.exit(1)
}
console.log('verify-clip-editor-api-paths: OK')

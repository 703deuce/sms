#!/usr/bin/env node
/**
 * Deterministic, manual font vendoring step. Never part of a production build:
 * fetch from a pinned google/fonts commit and verify the original git blob
 * hash BEFORE writing exactly the same bytes to browser and worker folders.
 * Run at repository root: node new-app/scripts/vendor-ofl-fonts.mjs
 * Commit the TTFs after this has succeeded; do not use a runtime download.
 */
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const { revision, fonts, fallbackFonts = [] } = JSON.parse(await readFile(path.join(here, 'pinned-ofl-font-sources.json'), 'utf8'))
const browser = path.join(root, 'new-app/public/fonts/clip')
const worker = path.join(root, 'worker/v3/fonts/t6')
const hash = data => createHash('sha1').update('blob ' + data.length + String.fromCharCode(0)).update(data).digest('hex')

async function pinnedBlob(slug, file, expected) {
  const url = 'https://raw.githubusercontent.com/google/fonts/' + revision + '/ofl/' +
    slug + '/' + encodeURIComponent(file)
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) })
  if (!response.ok) throw new Error('upstream HTTP ' + response.status + ' for ' + slug + '/' + file)
  const data = Buffer.from(await response.arrayBuffer())
  if (hash(data) !== expected) throw new Error('upstream hash mismatch: ' + slug + '/' + file)
  return data
}
async function saveVerified(dir, name, bytes, expected) {
  await mkdir(dir, { recursive: true })
  const dst = path.join(dir, name)
  // Write via temporary file to avoid leaving partial fonts after a failure.
  const tmp = dst + '.partial'
  await writeFile(tmp, bytes)
  if (hash(await readFile(tmp)) !== expected) throw new Error('disk integrity mismatch: ' + dst)
  await rename(tmp, dst)
}
for (const font of [...fonts, ...fallbackFonts]) {
  const bytes = await pinnedBlob(font.slug, font.upstream, font.blobSha)
  if (bytes.length !== font.size) throw new Error('font size mismatch: ' + font.slug)
  const license = await pinnedBlob(font.slug, 'OFL.txt', font.licenseBlobSha)
  for (const dest of [browser, worker]) {
    await saveVerified(dest, font.local, bytes, font.blobSha)
    await saveVerified(path.join(dest, 'licenses'), font.slug + '-OFL.txt', license, font.licenseBlobSha)
  }
  const a = await readFile(path.join(browser, font.local))
  const b = await readFile(path.join(worker, font.local))
  if (!a.equals(b)) throw new Error('browser / worker binary mismatch: ' + font.slug)
  console.log('[font-vendor] verified', font.slug, font.assFamily, font.blobSha)
}
console.log('[font-vendor] all eight design families plus pinned fallback fonts and notices verified at', revision)

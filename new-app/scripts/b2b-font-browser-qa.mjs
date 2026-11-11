#!/usr/bin/env node
/** Real Chromium smoke check of the pinned clip font faces and glyph rendering.
 * Runs against a temporary same-origin static server, without app auth or paid services.
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { chromium } from 'playwright'

const appRoot = path.resolve(import.meta.dirname, '..')
const publicRoot = path.join(appRoot, 'public')
const current = fs.readFileSync(path.join(appRoot, 'lib/clips/font-manifest.ts'), 'utf8')
const original = [...current.matchAll(/"id": "([^"]+)"[\s\S]*?"assFamily": "([^"]+)"[\s\S]*?"cssWeight": ([0-9]+)[\s\S]*?"browserFile": "([^"]+)"/g)]
  .map(m => ({ id:m[1], family:m[2], weight:Number(m[3]), url:m[4] }))
const additions = JSON.parse(fs.readFileSync(path.join(appRoot, 'scripts/pinned-b2b-font-sources.json'), 'utf8'))
  .fonts.map(x => ({ id:x.slug, family:x.assFamily, weight:x.cssWeight, url:'/fonts/clip/' + x.local }))
const faces = [...original, ...additions]
if (original.length < 18 || additions.length !== 62 || faces.length < 80) {
  throw new Error('Invalid 80-family pinned font inventory, original=' + original.length + ' additional=' + additions.length)
}
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent((req.url ?? '/').split('?')[0])
  if (rel === '/') { res.writeHead(200, {'content-type':'text/html'}); res.end('<!doctype html><title>Transovo font QA</title>'); return }
  if (!rel.startsWith('/fonts/clip/') || rel.includes('..')) { res.writeHead(404); res.end(); return }
  const pathname = path.join(publicRoot, rel.replace(/^\/+/, ''))
  if (!pathname.startsWith(path.join(publicRoot, 'fonts/clip/'))) { res.writeHead(404); res.end(); return }
  try {
    const bytes = fs.readFileSync(pathname)
    res.writeHead(200, {'content-type': 'font/ttf', 'cache-control':'max-age=0'})
    res.end(bytes)
  } catch {
    res.writeHead(404); res.end()
  }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const address = server.address()
const port = address.port
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  await page.goto('http://127.0.0.1:' + port + '/')
  // Load one exact pinned face at a time. A family-wide document.fonts.check()
  // may return false when unrelated CSS faces have not finished loading.
  const report = await page.evaluate(async items => {
    const loaded = []
    for (const item of items) {
      const face = new FontFace(item.family, 'url("' + item.url + '")', { weight: String(item.weight), style:'normal' })
      await face.load()
      document.fonts.add(face)
      if (face.status !== 'loaded' || !document.fonts.has(face)) throw new Error('not loaded: ' + item.id)
      const canvas = document.createElement('canvas')
      canvas.width = 360; canvas.height = 100
      const context = canvas.getContext('2d')
      if (!context) throw new Error('canvas unavailable')
      context.fillStyle = '#fff'
      context.fillRect(0,0,canvas.width,canvas.height)
      context.fillStyle = '#000'
      context.font = String(item.weight) + ' 32px "' + item.family + '"'
      context.fillText('Aa Zz 09', 12, 55)
      const pixels = context.getImageData(0,0,360,100).data
      let ink=0
      for (let i=0;i<pixels.length;i+=4) if (pixels[i]<240) ink++
      if (ink < 20) throw new Error('empty glyph sample: ' + item.id)
      loaded.push(item.id)
    }
    return loaded
  }, faces)
  if (report.length !== faces.length) throw new Error('font coverage incomplete')
  console.info('[b2b:chromium-font-qa] verified faces=' + report.length)
} finally {
  await browser.close()
  await new Promise(resolve => server.close(resolve))
}

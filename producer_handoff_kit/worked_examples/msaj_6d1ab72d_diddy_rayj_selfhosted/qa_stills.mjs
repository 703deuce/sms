// node stills.mjs <outdir> t1 t2 ...   (480p stills straight from the composed page, no render)
import { createServer } from 'node:http'; import { readFile } from 'node:fs/promises'; import path from 'node:path'; import { createRequire } from 'node:module'; import fs from 'node:fs';
const [out, ...ts] = process.argv.slice(2); const root = path.resolve(process.env.FILM || '/workspace/motion_jobs/msaj_6d1ab72d-bcc8-4de7-9e37-2118a7f3506e/film');
const puppeteer = createRequire('/workspace/motion_engines/_capture/x.js')('puppeteer-core');
const mime = x => ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf' }[path.extname(x)] || 'application/octet-stream');
const server = createServer(async (q, r) => { try { const f = path.resolve(root, '.' + decodeURIComponent(new URL(q.url, 'http://x').pathname)); const d = await readFile(f); r.writeHead(200, { 'content-type': mime(f) }); r.end(d) } catch { r.writeHead(404); r.end() } });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--hide-scrollbars', '--font-render-hinting=none', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); await p.setViewport({ width: 854, height: 480, deviceScaleFactor: 1 }); p.on('pageerror', e => console.log('PAGEERR', e.message));
p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()) });
await p.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle0' });
fs.mkdirSync(out, { recursive: true });
for (const t of ts) { await p.evaluate(async t => { await window.__scene.seek(t); await new Promise(r => requestAnimationFrame(() => r())) }, +t); await p.screenshot({ path: `${out}/t${(+t).toFixed(2).padStart(5, '0')}.png`, type: 'png' }) }
await b.close(); server.close();

// check_page.mjs <root> <entry> <width> <height> <fps> <frameCount>
// Loads the composed page exactly like the Modal capture does (local server, non-local requests blocked,
// networkidle0, then window.__scene.seek must exist and window.__ready must already be true), then seeks
// frame 0, the middle and the last frame. Local, no network, 3 screenshots. Never touches Transovo.
import { createServer } from 'node:http'; import { readFile } from 'node:fs/promises'; import path from 'node:path';
import { createRequire } from 'node:module'; import { createHash } from 'node:crypto'; import fs from 'node:fs';
const [root, entry, w, h, f, n] = process.argv.slice(2); const W = +w, H = +h, FPS = +f, N = +n;
const cands = [process.env.PUPPETEER_DIR, '/workspace/motion_engines/_capture', process.cwd()].filter(Boolean);
let puppeteer; for (const c of cands) { try { puppeteer = createRequire(path.join(c, 'x.js'))('puppeteer-core'); break; } catch {} }
if (!puppeteer) { console.error('puppeteer-core not found (set PUPPETEER_DIR)'); process.exit(2); }
const chrome = [process.env.CHROMIUM_BIN, '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => p && fs.existsSync(p));
const rootDir = path.resolve(root);
const mime = x => ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp4': 'video/mp4', '.webm': 'video/webm' }[path.extname(x).toLowerCase()] || 'application/octet-stream');
const server = createServer(async (q, r) => { try { const file = path.resolve(rootDir, '.' + decodeURIComponent(new URL(q.url, 'http://x').pathname));
  if (!file.startsWith(rootDir + path.sep)) throw 0; const data = await readFile(file); r.writeHead(200, { 'content-type': mime(file), 'cache-control': 'no-store' }); r.end(data); } catch { r.writeHead(404); r.end(); } });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, protocolTimeout: 600000, args: ['--no-sandbox', '--hide-scrollbars', '--font-render-hinting=none', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = []; const shots = [];
try {
  const page = await browser.newPage(); await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.setRequestInterception(true); let blocked = 0, missing = 0;
  page.on('request', r => { try { const u = new URL(r.url()); if (u.hostname === '127.0.0.1' && u.port === String(port)) r.continue(); else if (u.protocol === 'data:' || u.protocol === 'blob:') r.continue(); else { blocked++; r.abort(); } } catch { r.abort(); } });
  page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) { missing++; console.log('HTTP ' + r.status() + ' ' + new URL(r.url()).pathname); } });
  page.on('pageerror', e => problems.push('page error: ' + String(e.message).slice(0, 200)));
  await page.goto(`http://127.0.0.1:${port}/${entry.split('/').map(encodeURIComponent).join('/')}`, { waitUntil: 'networkidle0', timeout: 120000 });
  const st = await page.evaluate(() => ({ seek: typeof window.__scene?.seek === 'function', ready: window.__ready === true }));
  if (!st.seek) problems.push('window.__scene.seek is not a function after load (Modal would fail)');
  if (!st.ready) problems.push('window.__ready is not true after networkidle0 (assign __scene and __ready only after fonts/data/first seek finish)');
  if (blocked) problems.push(blocked + ' non-local request(s) were blocked: the page must be fully self-contained');
  if (missing) problems.push(missing + ' local file(s) returned 404/4xx');
  if (st.seek) for (const i of [0, Math.floor(N / 2), N - 1]) {
    await page.evaluate(async t => { await window.__scene.seek(t); await new Promise(r => requestAnimationFrame(() => r())); }, i / FPS);
    const png = await page.screenshot({ type: 'png' }); shots.push(createHash('sha256').update(png).digest('hex').slice(0, 12)); }
  if (shots.length === 3) { console.log('frame hashes (first/middle/last): ' + shots.join(' ')); if (new Set(shots).size === 1) console.log('NOTE: first, middle and last frames are identical; fine only for a static film');
    const again = await page.evaluate(async t => { await window.__scene.seek(t); await new Promise(r => requestAnimationFrame(() => r())); return 1; }, 0);
    const png = await page.screenshot({ type: 'png' }); if (createHash('sha256').update(png).digest('hex').slice(0, 12) !== shots[0]) problems.push('seek is not deterministic: frame 0 differs when revisited'); }
} finally { await browser.close(); server.close(); }
if (problems.length) { console.error('PAGE CHECK FAILED:\n- ' + problems.join('\n- ')); process.exit(1); }
console.log('page check OK');

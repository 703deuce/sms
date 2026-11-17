// Browser engine adapter (three.js / GSAP / PixiJS / DOM / SVG / canvas2d). Same capture method as the production
// capture adapter (/workspace/motion_engines/_capture/capture.mjs): headless Chrome, SwiftShader GL, seek(t) per frame, PNG -> ffmpeg.
// Difference: the bundle comes from storage (materialized dir), editable props come in through window.__MS_HOST, assets by id.
import { launch } from 'puppeteer-core'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { spawn } from 'node:child_process';
import { CFG } from '../config.mjs'; import { mimeOf } from '../util.mjs';
export const CHROME_ARGS = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--hide-scrollbars', '--font-render-hinting=none'];
// local scene server: bundle files from the materialized dir, assets from the verified cache. No outbound network.
export async function sceneServer(bundleDir, assetPaths) {
  const srv = http.createServer((req, res) => { const u = new URL(req.url, 'http://x');
    if (u.pathname.startsWith('/__asset/')) { const id = u.pathname.slice(9); const p = assetPaths[id]; if (!p) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': p.mime || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' }); return fs.createReadStream(p.path).pipe(res); }
    const f = path.join(bundleDir, decodeURIComponent(u.pathname)); if (!f.startsWith(bundleDir + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': mimeOf(f) }); fs.createReadStream(f).pipe(res); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${srv.address().port}`;
  return { base, close: () => srv.close(), assetUrls: Object.fromEntries(Object.keys(assetPaths).map(id => [id, `${base}/__asset/${id}`])) };
}
export async function openScene({ bundleDir, entry = 'index.html', host, assetPaths, width = 1920, height = 1080 }) {
  const srv = await sceneServer(path.resolve(bundleDir), assetPaths);
  const browser = await launch({ executablePath: CFG.chrome, headless: true, args: CHROME_ARGS, defaultViewport: { width, height, deviceScaleFactor: 1 } });
  const page = await browser.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(String(e.message).slice(0, 300))); page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push('[console] ' + m.text().slice(0, 300)); });
  page.on('response', r => { if (r.status() >= 400) { const u = new URL(r.url()); if (!u.pathname.endsWith('favicon.ico')) errors.push(`[http ${r.status()}] ${u.pathname.slice(0, 120)}`); } });
  page.on('requestfailed', r => { const u = new URL(r.url()); if (!u.pathname.endsWith('favicon.ico')) errors.push('[requestfailed] ' + u.pathname); });
  if (host) await page.evaluateOnNewDocument(h => { window.__MS_HOST = h; }, { ...host, assetUrls: srv.assetUrls });
  await page.goto(`${srv.base}/${entry}`, { waitUntil: 'networkidle0', timeout: 180000 });
  if (errors.some(e => !e.startsWith('['))) { await browser.close(); srv.close(); throw new Error('scene did not become ready: ' + errors.join(' | ')); }
  let failFast; const pe = new Promise((_, rej) => { failFast = rej; }); page.on('pageerror', e => failFast(new Error('scene error before ready: ' + String(e.message).slice(0, 300))));
  try { await Promise.race([page.waitForFunction(host ? 'window.__ready === true && window.__msReady === true' : 'window.__ready === true && window.__scene', { timeout: 180000 }), pe]); }
  catch (e) { await browser.close(); srv.close(); throw new Error('scene did not become ready: ' + (errors.join(' | ') || e.message)); }
  await page.evaluate(() => document.fonts && document.fonts.ready);
  const close = async () => { await browser.close(); srv.close(); };
  return { page, browser, errors, close, chromeVersion: await browser.version() };
}
// render frames [from,to) to mp4 (H.264 High 4.2) or .mov (ProRes 4444 alpha). Returns report.
export async function renderBrowser({ bundleDir, entry, host, assetPaths, out, from = 0, to, fps, alpha = false, width = 1920, height = 1080, framesDir, onProgress, crf = 16 }) {
  const t0 = Date.now(); const S = await openScene({ bundleDir, entry, host, assetPaths, width, height });
  try {
    const { page } = S; const meta = await page.evaluate(() => ({ fps: window.__scene.fps, duration: window.__scene.duration, ms: !!window.__scene.validate }));
    fps = fps || meta.fps; to = to ?? meta.duration; const n = Math.round((to - from) * fps);
    let issues = [], describe = null, props = null;
    if (meta.ms) { issues = await page.evaluate(() => window.__scene.validate()); describe = await page.evaluate(() => window.__scene.describe()); props = await page.evaluate(() => window.__scene.getProps()); }
    const blocking = issues.filter(i => i.severity === 'error');
    if (blocking.length) return { ok: false, rejected: true, issues, errors: S.errors };
    const enc = out.endsWith('.mov') ? ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le'] : ['-c:v', 'libx264', '-profile:v', 'high', '-level:v', '4.2', '-pix_fmt', 'yuv420p', '-crf', String(crf), '-preset', 'medium', '-movflags', '+faststart'];
    fs.mkdirSync(path.dirname(out), { recursive: true }); if (framesDir) fs.mkdirSync(framesDir, { recursive: true });
    const tmp = out.replace(/(\.[^.]+)$/, '.tmp$1');
    const ff = spawn(CFG.ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-', '-frames:v', String(n), '-r', String(fps), ...enc, tmp], { stdio: ['pipe', 'ignore', 'pipe'] });
    let ferr = ''; ff.stderr.on('data', d => ferr += d); const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c + ' ' + ferr.slice(-300)))));
    const tr0 = Date.now();
    for (let i = 0; i < n; i++) { const t = from + i / fps;
      await page.evaluate(async t => { await window.__scene.seek(t); await new Promise(r => requestAnimationFrame(() => r())); }, t);
      const buf = await page.screenshot({ type: 'png', omitBackground: alpha, clip: { x: 0, y: 0, width, height } });
      if (framesDir) fs.writeFileSync(path.join(framesDir, `f_${String(i).padStart(5, '0')}.png`), buf);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (onProgress && i % 15 === 0) onProgress(i / n); }
    ff.stdin.end(); await done; fs.renameSync(tmp, out);
    return { ok: true, out, frames: n, fps, issues, describe, props, errors: S.errors, chrome: S.chromeVersion, renderMs: Date.now() - tr0, wallMs: Date.now() - t0 };
  } finally { await S.close(); }
}
// one still (poster / preview fallback)
export async function stillBrowser({ bundleDir, entry, host, assetPaths, t, out, width = 1920, height = 1080 }) {
  const S = await openScene({ bundleDir, entry, host, assetPaths, width, height });
  try { await S.page.evaluate(async t => { await window.__scene.seek(t); await new Promise(r => requestAnimationFrame(() => r())); }, t); fs.mkdirSync(path.dirname(out), { recursive: true }); await S.page.screenshot({ path: out, type: out.endsWith('.jpg') ? 'jpeg' : 'png', clip: { x: 0, y: 0, width, height } }); return { ok: true, out, errors: S.errors }; }
  finally { await S.close(); }
}

#!/usr/bin/env node
// Deterministic scene render entry point (POC of contract §6). No AI, no network, no paid calls.
//   node render.mjs --version project/versions/v1.json --scene S01 [--overrides variants/A.json] --out out/S01.mp4
//                   [--from s] [--to s] [--frames dir] [--report out/x.report.json] [--validate-only] [--allow-errors]
// Inputs: project version (pins theme version + bundle + per-scene overrides) + an optional override patch.
// The bundle is the SAME one the browser preview loads; props are applied through the same ms-props.js resolver.
import { launch } from 'puppeteer-core';
import http from 'node:http'; import handler from 'serve-handler';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const ROOT = path.dirname(new URL(import.meta.url).pathname);
const a = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) => { if (v.startsWith('--')) acc.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return acc; }, []));
if (!a.version || !a.scene || (!a.out && !a['validate-only'])) { console.error('need --version --scene --out'); process.exit(2); }
const isObj = o => o && typeof o === 'object' && !Array.isArray(o);
const merge = (x, y) => { if (!isObj(y)) return y; const o = isObj(x) ? { ...x } : {}; for (const k of Object.keys(y)) o[k] = isObj(y[k]) && isObj(o[k]) ? merge(o[k], y[k]) : y[k]; return o; };
const rd = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const verPath = path.resolve(a.version), ver = rd(verPath);
const theme = rd(path.resolve(path.dirname(verPath), ver.theme.file));
const scene = ver.scenes.find(s => s.sceneId === a.scene); if (!scene) throw new Error('scene not in project version');
const bundleDir = path.resolve(path.dirname(verPath), scene.bundle.path);
const manifest = rd(path.join(bundleDir, 'editable-elements.json'));
let overrides = { scenes: { [a.scene]: scene.overrides || {} } };
const patch = a.overrides ? rd(path.resolve(a.overrides)) : {};
overrides = merge(overrides, { theme: patch.theme || {}, scenes: patch.scenes || {} });
const registry = rd(path.join(ROOT, 'assets/registry.json')).assets;
const so = overrides.scenes[a.scene] || {}; const rend = so.render || {};
// ---- render_editable pre-steps (worker-side, deterministic, no AI) ----
const pre = [];
const grade = so.elements?.portrait?.grade;
if (grade && grade !== 'none') {
  const src = so.elements.portrait.image?.asset || manifest.elements.find(e => e.id === 'portrait').properties.image.default.asset;
  const inF = path.join(ROOT, registry[src].file); const dir = path.join(ROOT, 'out/derived'); fs.mkdirSync(dir, { recursive: true });
  const outF = path.join(dir, `${src}__${grade}.jpg`);
  execFileSync('python3', [path.join(ROOT, 'tools/grade_portrait.py'), inF, outF, grade]);
  const id = 'ast_' + crypto.createHash('sha256').update(fs.readFileSync(outF)).digest('hex').slice(0, 16);
  registry[id] = { kind: 'image', file: path.relative(ROOT, outF), mime: 'image/jpeg', derivedFrom: src, op: grade };
  so.elements.portrait.image = { asset: id }; pre.push({ op: 'portrait.grade', grade, from: src, to: id });
}
// ---- host: serve bundle + assets, mint session URLs for asset ids ----
const server = http.createServer((req, res) => handler(req, res, { public: ROOT, cleanUrls: false }));
await new Promise(r => server.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${server.address().port}`;
const assetUrls = Object.fromEntries(Object.entries(registry).map(([id, e]) => [id, `${base}/${e.file}`]));
const W = manifest.format.width, Hh = manifest.format.height;
const browser = await launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--hide-scrollbars', '--font-render-hinting=none'],
  defaultViewport: { width: W, height: Hh, deviceScaleFactor: 1 } });
const page = await browser.newPage();
const errs = []; page.on('pageerror', e => { errs.push(e.message); console.error('[pageerror]', e.message); if (!readyOnce) { console.error('bundle failed to boot'); process.exit(4); } });
let readyOnce = false;
page.on('console', m => { if (process.env.MS_DEBUG || (m.type() === 'error' && !/favicon/.test(m.text()))) console.error('[console]', m.type(), m.text()); });
page.on('requestfailed', r => console.error('[reqfail]', new URL(r.url()).pathname)); page.on('response', r => { if (r.status() >= 400) console.error('[http]', r.status(), new URL(r.url()).pathname); });
await page.evaluateOnNewDocument(h => { window.__MS_HOST = h; }, { theme, overrides, assetUrls, mode: 'render' });
const t0 = Date.now();
await page.goto(`${base}/${path.relative(ROOT, bundleDir)}/index.html`, { waitUntil: 'networkidle0', timeout: 120000 });
await page.waitForFunction('window.__ready === true && window.__msReady === true', { timeout: Number(process.env.MS_WAIT || 120000) }).catch(async e => { console.error('not ready:', await page.evaluate(() => JSON.stringify({ r: window.__ready, m: window.__msReady, S: !!window.S }))); throw e; });
readyOnce = true; await page.evaluate(() => document.fonts.ready);
const meta = await page.evaluate(() => ({ fps: window.__scene.fps, duration: window.__scene.duration, issues: window.__scene.validate(), props: window.__scene.getProps() }));
const fps = meta.fps, from = Number(a.from || 0), to = Number(a.to || meta.duration), n = Math.round((to - from) * fps);
await page.evaluate(async t => { await window.__scene.seek(t); }, meta.duration - 1 / fps);
const bounds = await page.evaluate(() => window.__scene.describe());
const report = { scene: a.scene, projectVersion: ver.projectVersion, themeVersion: ver.theme.themeVersion, overridesFile: a.overrides || null, pre, render: rend,
  chrome: await browser.version(), bundleSha256: crypto.createHash('sha256').update(['index.html', 'scene.js', 'ms-props.js', 'editable-elements.json'].map(f => fs.readFileSync(path.join(bundleDir, f))).join('')).digest('hex'),
  format: { width: W, height: Hh, fps, frames: n }, issues: meta.issues, holdFrameBounds: bounds, resolved: meta.props };
const blocking = meta.issues.filter(i => i.severity === 'error');
const done = (code) => { if (a.report) { fs.mkdirSync(path.dirname(path.resolve(a.report)), { recursive: true }); fs.writeFileSync(a.report, JSON.stringify(report, null, 1)); } return browser.close().then(() => { server.close(); process.exit(code); }); };
if (a['validate-only']) { console.log(JSON.stringify({ issues: meta.issues, bounds }, null, 1)); await done(blocking.length ? 3 : 0); }
if (blocking.length && !a['allow-errors']) { console.error('validation errors, not rendering:', JSON.stringify(blocking)); await done(3); }
// ---- encode: H.264 High, level 4.2, yuv420p (same family as the production pipeline) ----
const vf = []; if (rend.grain) vf.push(`noise=alls=${Number(rend.grain)}:allf=t:all_seed=20261117`);
fs.mkdirSync(path.dirname(path.resolve(a.out)), { recursive: true }); if (a.frames) fs.mkdirSync(a.frames, { recursive: true });
const tmp = a.out.replace(/(\.[^.]+)$/, '.tmp$1');
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-', '-frames:v', String(n), '-r', String(fps),
  ...(vf.length ? ['-vf', vf.join(',')] : []), '-c:v', 'libx264', '-profile:v', 'high', '-level:v', '4.2', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'medium', '-threads', '8', '-movflags', '+faststart', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
const fin = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))));
for (let i = 0; i < n; i++) { const t = from + i / fps;
  await page.evaluate(async t => { await window.__scene.seek(t); await new Promise(r => requestAnimationFrame(() => r())); }, t);
  const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: Hh } });
  if (a.frames) fs.writeFileSync(path.join(a.frames, `f_${String(i).padStart(5, '0')}.png`), buf);
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); }
ff.stdin.end(); await fin; fs.renameSync(tmp, a.out);
report.renderSeconds = Math.round((Date.now() - t0) / 1000); report.output = a.out; report.pageErrors = errs;
console.log(`wrote ${a.out}: ${n} frames @ ${fps} fps, ${W}x${Hh}; issues: ${meta.issues.map(i => i.severity + ':' + i.code).join(', ') || 'none'}`);
await done(0);

#!/usr/bin/env node
// Motion Studio frame-capture adapter for browser engines (PixiJS, three.js/Theatre, GSAP/SVG, p5, D3, MapLibre/deck.gl, Rive, Lottie, Motion Canvas player pages).
// Status: written 2026-11-16, NOT render-tested yet.
//
// Page contract (the scene's index.html must define, before setting window.__ready = true):
//   window.__scene = { fps: 30, duration: <seconds>, seek: async (t) => { /* draw the exact frame for time t (seconds) */ } }
// Time is driven ONLY by seek(t): pause every ticker/RAF loop (gsap.ticker.sleep(), app.ticker.stop(), p5 noLoop(), lottie goToAndStop, theatre sequence.position = t, ...).
//
// Usage:
//   node capture.mjs --dir <scene dir with index.html> --out out/S03.mp4 [--size 1080x1920] [--fps 30] [--from 0] [--to <s>]
//        [--alpha]            transparent background -> use --out *.mov (ProRes 4444) or *.webm (VP9 alpha) or a PNG folder
//        [--canvas '#c']      grab one <canvas> via toDataURL instead of a full-page screenshot (faster for WebGL/2D canvas engines)
//        [--frames dir/]      also keep the PNG frames
import { launch } from 'puppeteer-core';
import http from 'node:http';
import handler from 'serve-handler';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const a = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) => {
  if (v.startsWith('--')) acc.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc; }, []));
if (!a.dir || !a.out) { console.error('need --dir and --out'); process.exit(2); }
const [W, H] = (a.size || '1920x1080').split('x').map(Number);
const alpha = !!a.alpha;

const server = http.createServer((req, res) => handler(req, res, { public: path.resolve(a.dir) }));
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/index.html`;

const browser = await launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
         '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--hide-scrollbars', '--font-render-hinting=none'],
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
page.on('pageerror', e => console.error('[pageerror]', e.message));
page.on('console', m => { if (m.type() === 'error') console.error('[console]', m.text()); });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
await page.waitForFunction('window.__ready === true && window.__scene', { timeout: 120000 });
await page.evaluate(() => document.fonts && document.fonts.ready);
const meta = await page.evaluate(() => ({ fps: window.__scene.fps, duration: window.__scene.duration }));
const fps = Number(a.fps || meta.fps || 30);
const t0 = Number(a.from || 0), t1 = Number(a.to || meta.duration);
const n = Math.round((t1 - t0) * fps);
if (a.frames) fs.mkdirSync(a.frames, { recursive: true });

const ext = path.extname(a.out).toLowerCase();
const enc = ext === '.mov' ? ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le']
          : ext === '.webm' ? ['-c:v', 'libvpx-vp9', '-pix_fmt', alpha ? 'yuva420p' : 'yuv420p', '-b:v', '0', '-crf', '24', '-row-mt', '1']
          : ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'medium', '-movflags', '+faststart'];
fs.mkdirSync(path.dirname(path.resolve(a.out)), { recursive: true });
const tmp = a.out.replace(/(\.[^.]+)$/, '.tmp$1');
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
  '-frames:v', String(n), '-r', String(fps), ...enc, tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))));

for (let i = 0; i < n; i++) {
  const t = t0 + i / fps;
  await page.evaluate(async t => { await window.__scene.seek(t); await new Promise(r => requestAnimationFrame(() => r())); }, t);
  let buf;
  if (a.canvas) {
    const b64 = await page.evaluate(sel => document.querySelector(sel).toDataURL('image/png').split(',')[1], a.canvas);
    buf = Buffer.from(b64, 'base64');
  } else {
    buf = await page.screenshot({ type: 'png', omitBackground: alpha, clip: { x: 0, y: 0, width: W, height: H } });
  }
  if (a.frames) fs.writeFileSync(path.join(a.frames, `f_${String(i).padStart(5, '0')}.png`), buf);
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (i % fps === 0) process.stderr.write(`frame ${i}/${n}\r`);
}
ff.stdin.end(); await done; fs.renameSync(tmp, a.out);
await browser.close(); server.close();
console.log(`wrote ${a.out}: ${n} frames @ ${fps} fps, ${W}x${H}${alpha ? ' (alpha)' : ''}`);

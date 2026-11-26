#!/usr/bin/env node
// Frame-exact capture for any browser scene (GSAP/SVG, PixiJS, p5, D3, three.js, Lottie, Rive, Skia, MapLibre).
// The page must set window.__scene = {fps, duration, seek: async t => {...}} and window.__ready = true.
// Usage: node capture.mjs --dir scenes/S04 --out out/S04.mp4 [--size 854x480] [--alpha] [--t0 0 --t1 4] [--still 1.5,3]
// --still writes PNGs (review) instead of video. --alpha writes ProRes 4444 .mov with transparency.
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire('/opt/engines/js/node_modules/');
const handler = require('serve-handler');
const puppeteer = require('puppeteer-core');

const a = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) => {
  if (v.startsWith('--')) acc.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc; }, []));
const dir = path.resolve(a.dir || '.');
const [W, H] = String(a.size || '854x480').split('x').map(Number);
const server = http.createServer((req, res) => handler(req, res, { public: dir, symlinks: true }));
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars', '--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction('window.__ready === true', { timeout: 60000 });
  await page.evaluate('document.fonts ? document.fonts.ready : null');
  const fps = Number(a.fps || await page.evaluate('window.__scene.fps') || 30);
  const dur = Number(await page.evaluate('window.__scene.duration'));
  const shot = async t => { await page.evaluate(`window.__scene.seek(${t})`); return page.screenshot({ type: 'png', omitBackground: !!a.alpha }); };
  if (a.still) {
    fs.mkdirSync(path.dirname(path.resolve(a.out || 'out/still.png')), { recursive: true });
    for (const t of String(a.still).split(',').map(Number)) {
      const f = path.resolve((a.out || 'out/still.png').replace(/\.png$/, '') + `_${t.toFixed(2)}.png`);
      fs.writeFileSync(f, await shot(t)); console.log(f);
    }
  } else {
    const t0 = Number(a.t0 || 0), t1 = Number(a.t1 || dur), n = Math.round((t1 - t0) * fps);
    const out = path.resolve(a.out || 'out/scene.mp4'); fs.mkdirSync(path.dirname(out), { recursive: true });
    const enc = a.alpha ? ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le']
                        : ['-c:v', 'libx264', '-crf', String(a.crf || 26), '-preset', 'medium', '-pix_fmt', 'yuv420p'];
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-', ...enc, out], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let i = 0; i < n; i++) { const buf = await shot(t0 + i / fps); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); }
    ff.stdin.end(); const code = await new Promise(r => ff.on('close', r));
    if (code !== 0) throw new Error('ffmpeg exit ' + code);
    console.log(out, n, 'frames');
  }
} finally { await browser.close(); server.close(); }

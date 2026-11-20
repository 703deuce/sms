#!/usr/bin/env node
// scene_lint.mjs — self-check while building (SKILL.md Stage 4c step 4). Headless Chrome, seeks the scene through its change
// points, reads layer boxes from the lint hook, no screenshots saved, no video. Fails on: text overflow/clipping, text colliding
// with other layers (unless allowOverlap with a reason), text outside the safe area, cap height under the readable minimum,
// low contrast behind text, faces off-centre in their box, blank/missing planned layers vs layout.json, visual hits more than
// 200 ms early/late vs words.json (via layout.json). Exit 0 pass, 1 fail, 2 setup error.
//
//   node scene_lint.mjs <sceneDir|index.html> [--layout design/layout.json --scene S1 | --film] [--size WxH] [--query k=v]
//        [--root DIR] [--host host.json] [--times 0,1.2] [--dense 250] [--json report.json] [--no-contrast] [--no-faces] [--quiet]
import { createRequire } from 'node:module'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { spawn } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(process.env.MS_PUPPETEER_FROM || '/workspace/motion_engines/_capture/package.json');
const { launch } = require('puppeteer-core');
require(path.join(HERE, 'components/ms-core.js')); const C = globalThis.MSCore;
const CHROME = process.env.MS_CHROME || '/usr/bin/google-chrome';
const RUNTIME = process.env.MS_LAYER_RUNTIME || '/workspace/ms_producer_editable/producer/runtime';
const CHROME_ARGS = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--hide-scrollbars', '--font-render-hinting=none'];
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css', json: 'application/json', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', wasm: 'application/wasm', ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2', mp4: 'video/mp4', webm: 'video/webm', wav: 'audio/wav', mp3: 'audio/mpeg' };

// polygon (projected 3D quad) vs rect: intersection area by Sutherland–Hodgman clipping
function polyRectArea(poly, r) { let P = poly.map(p => [p[0], p[1]]);
  const clip = (inside, cut) => { const out = []; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], ia = inside(a), ib = inside(b);
    if (ia) out.push(a); if (ia !== ib) out.push(cut(a, b)); } P = out; };
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  clip(p => p[0] >= r.x, (a, b) => lerp(a, b, (r.x - a[0]) / (b[0] - a[0]))); if (!P.length) return 0;
  clip(p => p[0] <= r.x + r.w, (a, b) => lerp(a, b, (r.x + r.w - a[0]) / (b[0] - a[0]))); if (!P.length) return 0;
  clip(p => p[1] >= r.y, (a, b) => lerp(a, b, (r.y - a[1]) / (b[1] - a[1]))); if (!P.length) return 0;
  clip(p => p[1] <= r.y + r.h, (a, b) => lerp(a, b, (r.y + r.h - a[1]) / (b[1] - a[1]))); if (P.length < 3) return 0;
  let A = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; A += a[0] * b[1] - b[0] * a[1]; } return Math.abs(A) / 2; }
function polyContainsRect(poly, r) { return Math.abs(polyRectArea(poly, r) - r.w * r.h) < 0.5; }

// ---------------- args ----------------
function args(argv) { const a = { _: [] }; for (let i = 0; i < argv.length; i++) { const k = argv[i]; if (!k.startsWith('--')) { a._.push(k); continue; }
  const n = k.slice(2); if (['film', 'no-contrast', 'no-faces', 'quiet'].includes(n)) a[n] = true; else a[n] = argv[++i]; } return a; }
const A = args(process.argv.slice(2));
const die = (m) => { console.error('scene_lint: ' + m); process.exit(2); };
if (!A._[0]) die('usage: node scene_lint.mjs <sceneDir|index.html> [--layout layout.json --scene S1|--film] [--size WxH] ... (see README.md)');
const T0 = Date.now();
let entry = path.resolve(A._[0]); if (fs.statSync(entry).isDirectory()) entry = path.join(entry, 'index.html'); if (!fs.existsSync(entry)) die('no ' + entry);
const sceneDir = path.dirname(entry);
const isLayerScene = fs.existsSync(path.join(sceneDir, 'layers.json'));
function findUp(dir, name) { for (let d = dir; ; d = path.dirname(d)) { if (fs.existsSync(path.join(d, name))) return d; if (path.dirname(d) === d) return null; } }
const root = path.resolve(A.root || (isLayerScene && findUp(sceneDir, 'project.live.json')) || path.dirname(sceneDir));
if (!entry.startsWith(root + path.sep)) die('scene must be inside --root');
const LAYOUT = A.layout ? JSON.parse(fs.readFileSync(A.layout, 'utf8')) : null;
const LSPEC = isLayerScene ? JSON.parse(fs.readFileSync(path.join(sceneDir, 'layers.json'), 'utf8')) : null;
let W, H; if (A.size) [W, H] = A.size.toLowerCase().split('x').map(Number); else if (LSPEC) ({ width: W, height: H } = LSPEC); else if (LAYOUT?.size) ({ w: W, h: H } = LAYOUT.size); else die('--size WxH is required for this scene');
const FLOOR = C.capFloor(W, H), SAFE = C.safeArea(W, H);
const TH = { contrast: +(A.contrast || 4.5), contrastLarge: +(A['contrast-large'] || 3), late: +(A['hit-late'] || 200), early: +(A['hit-early'] || 200), overlapPx: 4 };

// ---------------- planned layers (layout.json) in page time ----------------
let planned = [];
if (LAYOUT) {
  const scenes = A.film ? LAYOUT.scenes : LAYOUT.scenes.filter(s => s.sceneId === (A.scene || LSPEC?.sceneId));
  if (!scenes.length) die(`layout has no scene ${A.scene || LSPEC?.sceneId} (use --scene or --film)`);
  for (const s of scenes) for (const l of s.layers) { const off = A.film ? (s.offsetMs || 0) : 0;
    planned.push({ ...l, sceneId: s.sceneId, inS: (l.window.inMs + off) / 1000, outS: (l.window.outMs + off) / 1000, hitS: l.hit ? (l.hit.expectMs + off) / 1000 : null }); }
}
const plannedById = new Map(planned.map(p => [p.id, p]));

// ---------------- static server (+ layer-scene runtime fallback for ms/*) ----------------
const srv = http.createServer((req, res) => { const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = path.join(root, u); if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { const m = /\/ms\/([\w.-]+\.js)$/.exec(u); if (m && fs.existsSync(path.join(RUNTIME, m[1]))) f = path.join(RUNTIME, m[1]); else { res.writeHead(404); return res.end(); } }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).slice(1).toLowerCase()] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => srv.listen(0, '127.0.0.1', r)); const BASE = `http://127.0.0.1:${srv.address().port}`;

// host payload for the layer-scene runtime (theme + fonts), like the live player sends
let HOST = null;
if (isLayerScene) {
  if (A.host) HOST = JSON.parse(fs.readFileSync(A.host, 'utf8'));
  else { const pr = findUp(sceneDir, 'project.live.json'); if (!pr) die('layer scene needs --host host.json or a project.live.json above it');
    const P = JSON.parse(fs.readFileSync(path.join(pr, 'project.live.json'), 'utf8'));
    const rel = path.relative(root, pr); const fu = {}, fr = {};
    for (const [id, f] of Object.entries(P.fonts || {})) { fu[id] = `${BASE}/${rel ? rel + '/' : ''}${f.src}`; fr[id] = f.record; }
    HOST = { theme: P.theme, overrides: P.overrides || {}, assetUrls: fu, fonts: fr, assets: {}, mode: 'live' }; }
  for (const [id, u] of Object.entries(HOST.assetUrls || {})) if (u.startsWith('/')) HOST.assetUrls[id] = BASE + u;
}

// ---------------- face worker ----------------
let faceProc = null, faceQ = new Map(), faceBuf = '', faceSeq = 0;
function faceCheck(png, n = 1) { if (!faceProc) { faceProc = spawn('python3', [path.join(HERE, 'face_frame.py'), '--serve'], { stdio: ['pipe', 'pipe', 'inherit'], env: { ...process.env, OPENCV_LOG_LEVEL: 'ERROR' } });
    faceProc.stdout.on('data', d => { faceBuf += d; let i; while ((i = faceBuf.indexOf('\n')) >= 0) { const line = faceBuf.slice(0, i); faceBuf = faceBuf.slice(i + 1); try { const m = JSON.parse(line); faceQ.get(m.id)?.(m); faceQ.delete(m.id); } catch { } } }); }
  const id = ++faceSeq; return new Promise(r => { faceQ.set(id, r); faceProc.stdin.write(JSON.stringify({ id, png, n }) + '\n'); }); }

// ---------------- browser ----------------
const browser = await launch({ executablePath: CHROME, headless: true, args: CHROME_ARGS, defaultViewport: { width: W, height: H, deviceScaleFactor: 1 } });
const report = { schema: 'ms.scene_lint/1', scene: path.relative(process.cwd(), entry), size: { w: W, h: H }, capFloorPx: +FLOOR.toFixed(1), safeArea: SAFE.kind, failures: [], warnings: [], samples: 0 };
let exitCode = 0;
try {
  const page = await browser.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 200))); page.on('response', r => { if (r.status() >= 400 && !/favicon\.ico$/.test(r.url())) errs.push(`[http ${r.status()}] ${new URL(r.url()).pathname.slice(0, 120)}`); });
  if (HOST) await page.evaluateOnNewDocument(h => { window.__MS_HOST = h; }, HOST);
  const url = `${BASE}/${path.relative(root, entry).split(path.sep).join('/')}${A.query ? '?' + A.query : ''}`;
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
  let failFast; const pe = new Promise((_, rej) => { failFast = rej; }); page.on('pageerror', e => failFast(new Error(String(e.message).slice(0, 300))));
  if (errs.some(e => !e.startsWith('['))) throw new Error('scene error before ready: ' + errs.join(' | '));
  try { await Promise.race([page.waitForFunction(HOST ? 'window.__ready === true && window.__msReady === true' : 'window.__ready === true && !!window.__scene', { timeout: 60000 }), pe]); }
  catch (e) { throw new Error('scene never became ready (window.__ready / __scene): ' + (errs.join(' | ') || e.message)); }
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.addScriptTag({ content: fs.readFileSync(path.join(HERE, 'components/ms-core.js'), 'utf8') });
  await page.addScriptTag({ content: fs.readFileSync(path.join(HERE, 'lint/probe.js'), 'utf8') });
  const meta = await page.evaluate(async () => ({ fps: window.__scene.fps || 30, duration: window.__scene.duration, src: await window.__msProbe.source(), cps: await window.__msProbe.changePoints() }));
  if (!meta.src) throw new Error('NO_LINT_HOOK: the scene exposes neither window.__msLint nor the layer-scene runtime (README: "Exposing the lint hook")');
  const fps = meta.fps, frame = 1 / fps, dur = meta.duration || (planned.length ? Math.max(...planned.map(p => p.outS)) : 0);
  report.source = meta.src; report.duration = dur;
  const seek = async (t, pixels = true) => page.evaluate(async (t, g) => { window.__msLintGeometryOnly = g; await window.__scene.seek(t); await new Promise(r => requestAnimationFrame(() => r())); }, t, !pixels);
  const collect = async (t, pixels = false) => { await seek(t, pixels); const r = await page.evaluate(t => window.__msProbe.collect(t), t); if (r.error) throw new Error(r.error); return r.layers; };

  // ---- sample times: change points, their midpoints, planned windows and hits, first/last frame ----
  const last = Math.max(0, dur - frame);
  let ts = [0, last, ...(meta.cps || []).map(Number).filter(Number.isFinite)];
  for (const p of planned) { ts.push(p.inS + 0.4, (p.inS + p.outS) / 2, p.outS - frame); if (p.hitS != null) ts.push(p.hitS + 0.25); }
  if (A.times) ts.push(...A.times.split(',').map(Number));
  ts = [...new Set(ts.map(t => Math.min(last, Math.max(0, Math.round(t * fps) / fps))))].sort((a, b) => a - b);
  const mids = []; for (let i = 1; i < ts.length; i++) if (ts[i] - ts[i - 1] > 0.15) mids.push(Math.round((ts[i] + ts[i - 1]) / 2 * fps) / fps);
  if (A.dense) for (let t = 0; t < last; t += +A.dense / 1000) mids.push(Math.round(t * fps) / fps);
  ts = [...new Set([...ts, ...mids])].sort((a, b) => a - b);

  const snaps = []; for (const t of ts) snaps.push({ t, layers: await collect(t) });
  report.samples = snaps.length;

  // ---- per-layer tracks and "settled" (full size, opaque, not moving vs its next sample) ----
  const tracks = new Map();
  for (const s of snaps) for (const l of s.layers) { if (!tracks.has(l.id)) tracks.set(l.id, []); tracks.get(l.id).push({ t: s.t, l }); }
  const sizeOf = l => l.text ? l.text.fontPx : (l.box ? l.box.w * l.box.h : 0);
  const restSize = new Map([...tracks].map(([id, tr]) => [id, Math.max(0, ...tr.filter(x => x.l.opacity >= 0.5).map(x => sizeOf(x.l)))]));
  const boxKey = l => l.text?.inkBox || l.box;
  function settled(id, i) { const tr = tracks.get(id), x = tr[i].l; if (!(x.opacity >= 0.98)) return false; const rs = restSize.get(id);
    if (rs && Math.abs(sizeOf(x) - rs) > 0.03 * rs) return false;
    const nx = tr.slice(i + 1).find(y => y.l.opacity >= 0.5); if (!nx) return true; const a = boxKey(x), b = boxKey(nx.l); if (!a || !b) return true;
    return Math.abs(a.x - b.x) <= 1.5 && Math.abs(a.y - b.y) <= 1.5 && Math.abs(a.w - b.w) <= 1.5 && Math.abs(a.h - b.h) <= 1.5; }
  const settledAt = new Map(); for (const [id, tr] of tracks) settledAt.set(id, new Set(tr.map((x, i) => settled(id, i) ? x.t : null).filter(v => v != null)));
  if (process.env.MS_LINT_DEBUG) for (const id of process.env.MS_LINT_DEBUG.split(',')) for (const x of tracks.get(id) || []) console.error('[debug]', id, x.t.toFixed(3), 'op', x.l.opacity?.toFixed(2), 'font', x.l.text?.fontPx?.toFixed(1), 'cap', x.l.text?.capPx?.toFixed(1), 'ink', JSON.stringify(x.l.text?.inkBox || x.l.box), settledAt.get(id).has(x.t) ? 'SETTLED' : '');

  // ---- findings ----
  const F = new Map(), Wn = new Map();
  const fail = (code, layer, t, detail) => { const k = code + '|' + layer; if (!F.has(k)) F.set(k, { code, layer, t: +t.toFixed(3), count: 0, detail }); F.get(k).count++; };
  const warn = (code, layer, t, detail) => { const k = code + '|' + layer; if (!Wn.has(k)) Wn.set(k, { code, layer, t: t == null ? null : +t.toFixed(3), count: 0, detail }); Wn.get(k).count++; };
  const allowed = (a, b) => { const ok = (x, y) => { const L = x.allowOverlap || plannedById.get(x.id)?.allowOverlap; if (!L) return false;
      return (Array.isArray(L) ? L : [L]).some(e => e === true || e === '*' || e === y.id || (e && (e.with === y.id || e.with === '*'))); };
    return ok(a, b) || ok(b, a); };
  const isPlate = (o, txt) => { const pf = o.plateFor || plannedById.get(o.id)?.plateFor; return pf && (Array.isArray(pf) ? pf : [pf]).includes(txt.id); };
  const r1 = v => Math.round(v * 10) / 10;

  for (const s of snaps) {
    const vis = s.layers.filter(l => !l.missing && l.opacity >= 0.3 && (l.box || l.text));
    for (const l of vis) {
      if (!l.text || !l.text.value || !l.text.value.trim()) continue;
      const T = l.text, ink = T.inkBox; if (!ink) continue;
      const isSet = settledAt.get(l.id)?.has(s.t);
      // overflow: the text's layout box is bigger than the box it was fitted into
      if (T.fitBox && T.layout && T.fitBox !== T.layout) {
        const ow = T.layout.w - T.fitBox.w, inkOut = Math.max(T.fitBox.y - ink.y, ink.y + ink.h - (T.fitBox.y + T.fitBox.h), T.fitBox.x - ink.x, ink.x + ink.w - (T.fitBox.x + T.fitBox.w));
        if (ow > 1.5 || inkOut > 1.5) fail('TEXT_OVERFLOW', l.id, s.t, `text ${r1(T.layout.w)}x${r1(T.layout.h)} (ink ${r1(ink.w)}x${r1(ink.h)}) overflows its ${r1(T.fitBox.w)}x${r1(T.fitBox.h)} box by ${r1(Math.max(ow, inkOut))}px`);
      }
      if (isSet) {
        // clipped by the frame or a clipping container
        const out = Math.max(-ink.x, -ink.y, ink.x + ink.w - W, ink.y + ink.h - H);
        if (out > 1) fail('TEXT_CLIPPED', l.id, s.t, `ink ${r1(out)}px outside the frame`);
        for (const c of T.clips || []) { const o2 = Math.max(c.box.x - ink.x, c.box.y - ink.y, ink.x + ink.w - (c.box.x + c.box.w), ink.y + ink.h - (c.box.y + c.box.h)); if (o2 > 1) fail('TEXT_CLIPPED', l.id, s.t, `ink ${r1(o2)}px outside clipping container ${c.tag}`); }
        const e = C.safeExcess(ink, SAFE); if (C.isOut(e)) fail('OUTSIDE_SAFE_AREA', l.id, s.t, `ink ${JSON.stringify({ x: r1(ink.x), y: r1(ink.y), w: r1(ink.w), h: r1(ink.h) })} leaves the ${SAFE.kind} area by ${JSON.stringify(Object.fromEntries(Object.entries(e).filter(([, v]) => v > 0)))}`);
        const isCredit = (l.role || plannedById.get(l.id)?.role) === 'credit'; // Rick, Nov 18: source/credit lines may stay small
        if (!isCredit && T.capPx < FLOOR - 0.25) fail('CAP_TOO_SMALL', l.id, s.t, `cap height ${r1(T.capPx)}px < ${r1(FLOOR)}px (40px at 1080p) at ${r1(T.fontPx)}px font: "${T.value.slice(0, 40)}"`);
      }
      // collisions: text ink vs other text ink / other layer boxes
      for (const o of vis) { if (o.id === l.id || o.role === 'background' || allowed(l, o) || isPlate(o, l)) continue;
        const otherRects = o.text ? o.text.ink : [o.box];
        if (!o.text && o.poly) { if (polyContainsRect(o.poly, ink)) continue; let best = 0; for (const a of T.ink) best = Math.max(best, polyRectArea(o.poly, a));
          if (best > TH.overlapPx) fail('COLLISION', l.id + '×' + o.id, s.t, `${l.id} (text) overlaps ${o.id} (${o.kind}) by ${r1(best)}px²; separate the slots or mark allowOverlap with a reason`); continue; }
        if (!o.text && o.box && C.contains(o.box, ink, 0.75)) continue;     // text sits inside a panel/footage box: an overlay, judged by contrast
        if (o.text && o.text.value?.trim() && l.id > o.id) continue;   // each text pair reported once
        let hit = null; for (const a of T.ink) for (const b of otherRects) { const i = b && C.inter(a, b); if (i && i.w > 1 && i.h > 1 && i.w * i.h > TH.overlapPx) hit = hit && C.area(hit) > C.area(i) ? hit : i; }
        if (hit) fail('COLLISION', l.id + '×' + o.id, s.t, `${l.id} (text) overlaps ${o.id} (${o.kind}) by ${r1(hit.w)}x${r1(hit.h)}px; separate the slots or mark allowOverlap with a reason`);
      }
    }
  }

  // ---- contrast behind text (settled samples; first and last per layer) ----
  const colliding = new Set([...F.values()].filter(f => f.code === 'COLLISION').flatMap(f => f.layer.split('×')));
  if (!A['no-contrast']) {
    const want = new Map();   // t -> [layer ids]  (first and last settled sample of each text layer; one full render per time)
    for (const [id, tr] of tracks) { if (colliding.has(id)) continue;   // fix the collision first; its background is the other layer
      const st = tr.filter(x => settledAt.get(id).has(x.t) && x.l.text && x.l.text.value?.trim()); if (!st.length) continue;
      for (const x of new Set([st[0], st[st.length - 1]])) { if (!want.has(x.t)) want.set(x.t, []); want.get(x.t).push(id); } }
    for (const [t, ids] of [...want].sort((a, b) => a[0] - b[0])) {
      const ls = await collect(t, true);
      for (const id of ids) { const l = ls.find(x => x.id === id); if (!l || !l.text) continue; const T = l.text; const ink = T.inkBox;
        const clip = { x: Math.max(0, Math.floor(ink.x)), y: Math.max(0, Math.floor(ink.y)) }; clip.width = Math.min(W, Math.ceil(ink.x + ink.w)) - clip.x; clip.height = Math.min(H, Math.ceil(ink.y + ink.h)) - clip.y; if (clip.width < 2 || clip.height < 2) continue;
        const hid = await page.evaluate(id => window.__msProbe.hide(id, true), id);
        if (hid) await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
        const b64 = await page.screenshot({ clip, encoding: 'base64' });
        if (hid) await page.evaluate(id => window.__msProbe.hide(id, false), id);
        const c = await page.evaluate((b, h, ex) => window.__msProbe.contrastOf(b, h, ex), b64, T.color, !hid);
        const large = T.capPx >= 1.5 * FLOOR, need = large ? TH.contrastLarge : TH.contrast;
        if (c.p10 != null && c.p10 < need) (hid ? fail : warn)('CONTRAST_LOW', id, t, `text ${T.color} vs background: 90% of pixels reach only ${c.p10}:1 (median ${c.median}:1), need ${need}:1${large ? ' (large text)' : ''}${hid ? '' : ' [approximate: scene has no hide() for this layer]'}`); }
    }
  }

  // ---- planned layers: present, visible, not blank, in their slot, right text ----
  for (const p of planned) {
    const inWin = snaps.filter(s => s.t >= p.inS + 0.2 && s.t < p.outS - frame / 2);
    const chk = inWin.length ? [inWin[0], inWin[Math.floor(inWin.length / 2)]] : snaps.filter(s => s.t >= p.inS && s.t < p.outS).slice(0, 1);
    if (!chk.length) { warn('NO_SAMPLE_IN_WINDOW', p.id, p.inS, 'planned window too short to sample'); continue; }
    for (const s of chk) {
      const l = s.layers.find(x => x.id === p.id);
      if (!l || l.missing) { fail('MISSING_LAYER', p.id, s.t, `planned ${p.kind} "${p.id}" is not in the scene`); break; }
      if (!(l.opacity >= 0.5)) { fail('LAYER_NOT_VISIBLE', p.id, s.t, `planned on screen ${p.inS.toFixed(2)}–${p.outS.toFixed(2)}s but opacity ${(l.opacity ?? 0).toFixed(2)}`); continue; }
      if (p.textKind || l.kind === 'text') { const v = l.text?.value?.trim(); if (!v) { fail('BLANK_LAYER', p.id, s.t, 'text layer is empty'); continue; }
        if (p.text != null) { const norm = x => String(x).toUpperCase().replace(/\s+/g, ' ').trim(); if (norm(v) !== norm(p.text)) fail('TEXT_MISMATCH', p.id, s.t, `on screen "${v.slice(0, 50)}" ≠ planned "${String(p.text).slice(0, 50)}"`); } }
      if (l.kind === 'media') {
        if (l.mediaLoaded === false) { fail('MEDIA_MISSING', p.id, s.t, 'media element has not loaded'); continue; }
        const b = l.box; const clip = { x: Math.max(0, Math.floor(b.x)), y: Math.max(0, Math.floor(b.y)) }; clip.width = Math.min(W, Math.ceil(b.x + b.w)) - clip.x; clip.height = Math.min(H, Math.ceil(b.y + b.h)) - clip.y;
        if (clip.width > 2 && clip.height > 2) { await seek(s.t, true); const st = await page.evaluate(b => window.__msProbe.pixelStats(b), await page.screenshot({ clip, encoding: 'base64' })); if (st.std < 3) fail('MEDIA_BLANK', p.id, s.t, `box is flat (luma std ${st.std}, mean ${st.mean})`); }
      }
      if (p.box && s === chk[chk.length - 1]) { const a = l.text ? (l.text.fitBox || l.box) : l.box; if (a) { const io = C.iou(a, p.box), dc = Math.hypot(a.x + a.w / 2 - p.box.x - p.box.w / 2, a.y + a.h / 2 - p.box.y - p.box.h / 2);
        if (io < 0.5 && dc > 0.05 * Math.hypot(W, H) && settledAt.get(p.id)?.has(s.t)) fail('OFF_SLOT', p.id, s.t, `settled at ${JSON.stringify({ x: r1(a.x), y: r1(a.y), w: r1(a.w), h: r1(a.h) })}, planned slot ${JSON.stringify(p.box)} (IoU ${io.toFixed(2)})`); } }
    }
  }
  if (planned.length) for (const id of tracks.keys()) if (!plannedById.has(id) && !planned.some(p => id.startsWith(p.id + '_'))) warn('UNPLANNED_LAYER', id, null, 'on screen but not in layout.json');

  // ---- visual hits vs word anchors (binary search for the first frame the layer is on screen) ----
  const onAt = async (id, t) => { const l = (await collect(t)).find(x => x.id === id); const rs = restSize.get(id) || 0; return !!(l && !l.missing && l.opacity >= 0.5 && (!rs || sizeOf(l) >= 0.6 * rs)); };
  report.hits = [];
  for (const p of planned.filter(p => p.hitS != null)) {
    let lo = Math.max(0, p.hitS - 0.6, p.inS - 0.6), hi = Math.min(last, p.hitS + 0.8, p.outS - frame);
    lo = Math.round(lo * fps) / fps; hi = Math.round(hi * fps) / fps;
    if (await onAt(p.id, lo)) { if (lo > 0 || p.hitS - lo > TH.early / 1000) { fail('HIT_EARLY', p.id, lo, `already on screen ${Math.round((p.hitS - lo) * 1000)}+ ms before "${p.hit.word}" (${p.hitS.toFixed(3)}s)`); report.hits.push({ id: p.id, word: p.hit.word, offsetMs: '<=-' + Math.round((p.hitS - lo) * 1000) }); } continue; }
    if (!(await onAt(p.id, hi))) { fail('HIT_LATE', p.id, hi, `not on screen by ${Math.round((hi - p.hitS) * 1000)} ms after "${p.hit.word}" (${p.hitS.toFixed(3)}s)`); report.hits.push({ id: p.id, word: p.hit.word, offsetMs: '>' + Math.round((hi - p.hitS) * 1000) }); continue; }
    let a = Math.round(lo * fps), b = Math.round(hi * fps);
    while (b - a > 1) { const m = (a + b) >> 1; if (await onAt(p.id, m / fps)) b = m; else a = m; }
    const on = b / fps, off = Math.round((on - p.hitS) * 1000);
    report.hits.push({ id: p.id, word: p.hit.word, wordS: +p.hitS.toFixed(3), onS: +on.toFixed(3), offsetMs: off });
    if (off > TH.late) fail('HIT_LATE', p.id, on, `lands ${off} ms after "${p.hit.word}" (limit +${TH.late} ms)`);
    else if (off < -TH.early) fail('HIT_EARLY', p.id, on, `lands ${-off} ms before "${p.hit.word}" (limit −${TH.early} ms)`);
    else if (off < -Math.round(frame * 1000)) warn('HIT_BEFORE_WORD', p.id, on, `lands ${-off} ms before "${p.hit.word}" (qa.md 7: 0 to +200 ms after the word)`);
  }

  // ---- faces centred in their boxes ----
  const faceLayers = [...tracks.keys()].filter(id => (plannedById.get(id)?.faces || tracks.get(id).some(x => x.l.faces)) && !plannedById.get(id)?.faceManual);
  if (!A['no-faces']) for (const id of faceLayers) {
    const tr = tracks.get(id).filter(x => x.l.opacity >= 0.98 && x.l.box); if (!tr.length) continue;
    for (const x of [...new Set([tr[0], tr[Math.floor(tr.length / 2)], tr[tr.length - 1]])]) {
      const b = x.l.box; const clip = { x: Math.max(0, Math.round(b.x)), y: Math.max(0, Math.round(b.y)) }; clip.width = Math.min(W, Math.round(b.x + b.w)) - clip.x; clip.height = Math.min(H, Math.round(b.y + b.h)) - clip.y;
      if (clip.width < 16 || clip.height < 16) continue;
      const nf = plannedById.get(id)?.faces || x.l.faces || 1;
      await seek(x.t, true); const r = await faceCheck(await page.screenshot({ clip, encoding: 'base64' }), nf);
      if (r.error) { warn('FACE_CHECK_ERROR', id, x.t, r.error); continue; }
      if (!r.faces.length) { fail('FACE_NOT_FOUND', id, x.t, 'a face is planned in this box but none was detected; check the frame and frame by hand (layout faceManual: reason)'); continue; }
      if (nf >= 2 && r.faces.length < nf) warn('FEWER_FACES', id, x.t, `planned ${nf} faces, found ${r.faces.length}`);
      // the face this box is about: among faces at least 35% the size of the biggest, the one nearest the box centre
      const big = Math.max(...r.faces.map(q => q.box[2] * q.box[3])); const cand = r.faces.filter(q => q.box[2] * q.box[3] >= 0.35 * big);
      const near = cand.sort((a, b) => Math.hypot(a.placed.centerX - 0.5, a.placed.eyeLine - 1 / 3) - Math.hypot(b.placed.centerX - 0.5, b.placed.eyeLine - 1 / 3))[0];
      if (nf === 1 && cand.length > 1) warn('EXTRA_FACE', id, x.t, `${cand.length} faces in a box planned for 1; the one nearest the centre is judged`);
      const f = nf >= 2 && r.group ? r.group : near;
      if (f.issues.length) fail('FACE_OFF_CENTRE', id, x.t, (nf >= 2 && r.group ? `group of ${nf}: ` : '') + f.issues.join('; ') + ` (box ${clip.width}x${clip.height})`);
    }
  }
  if (A.overlay != null) {   // opt-in debug still: ink/boxes/safe area drawn over the frame at one time (only when asked)
    const t = +A.overlay; const ls = await collect(t, true); const sa = SAFE;
    await page.evaluate((ls, sa, W, H) => { const c = document.createElement('canvas'); c.id = '__lintov'; c.width = W; c.height = H; c.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none'; document.body.appendChild(c);
      const x = c.getContext('2d'); x.lineWidth = 1; x.strokeStyle = '#00ff66'; x.setLineDash([4, 3]); x.strokeRect(sa.rect.x, sa.rect.y, sa.rect.w, sa.rect.h); x.setLineDash([]);
      if (sa.cutout) { x.beginPath(); x.moveTo(sa.cutout.xMax, sa.cutout.yFrom); x.lineTo(sa.cutout.xMax, sa.rect.y + sa.rect.h); x.stroke(); }
      for (const l of ls) { if (!(l.opacity >= 0.3)) continue; if (l.text) { x.strokeStyle = '#ff00ff'; for (const r of l.text.ink) x.strokeRect(r.x, r.y, r.w, r.h); x.strokeStyle = '#00c8ff'; const f = l.text.fitBox; if (f) x.strokeRect(f.x, f.y, f.w, f.h); }
        else if (l.poly) { x.strokeStyle = '#ffd400'; x.beginPath(); l.poly.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.stroke(); } else if (l.box) { x.strokeStyle = '#ffd400'; x.strokeRect(l.box.x, l.box.y, l.box.w, l.box.h); } } }, ls, sa, W, H);
    await page.screenshot({ path: A['overlay-out'] || 'lint_overlay.png' }); report.overlay = A['overlay-out'] || 'lint_overlay.png';
    await page.evaluate(() => document.getElementById('__lintov')?.remove());
  }
  report.failures = [...F.values()]; report.warnings = [...Wn.values()]; report.pageErrors = errs.slice(0, 5);
  if (errs.length) report.warnings.push({ code: 'PAGE_ERRORS', layer: null, count: errs.length, detail: errs[0] });
  report.ok = report.failures.length === 0; exitCode = report.ok ? 0 : 1;
} catch (e) { report.ok = false; report.error = String(e.message || e); exitCode = 2; }
finally { await browser.close(); srv.close(); if (faceProc) faceProc.kill(); }
report.ms = Date.now() - T0;
if (A.json) { fs.mkdirSync(path.dirname(path.resolve(A.json)), { recursive: true }); fs.writeFileSync(A.json, JSON.stringify(report, null, 1)); }
// ---------------- human summary ----------------
if (!A.quiet) {
  const head = `scene_lint ${report.ok ? 'PASS' : report.error ? 'ERROR' : 'FAIL'}  ${report.scene}  ${W}x${H}  ${report.samples} samples  ${(report.ms / 1000).toFixed(1)}s  (cap floor ${report.capFloorPx}px, ${report.safeArea})`;
  console.log(head); if (report.error) console.log('  ! ' + report.error);
  for (const f of report.failures) console.log(`  ✗ ${f.code.padEnd(17)} ${f.layer}  @${f.t}s${f.count > 1 ? ` (x${f.count})` : ''}  ${f.detail}`);
  for (const w of report.warnings) console.log(`  ! ${w.code.padEnd(17)} ${w.layer ?? ''}${w.t != null ? '  @' + w.t + 's' : ''}  ${w.detail}`);
  if (report.hits?.length) console.log('  hits: ' + report.hits.map(h => `${h.id}:${typeof h.offsetMs === 'number' ? (h.offsetMs >= 0 ? '+' : '') + h.offsetMs : h.offsetMs}ms`).join('  '));
}
process.exit(exitCode);

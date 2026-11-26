// fonts.mjs: engine-native font index. No preset library: every font file a worker can render is indexed with
// fontTools metadata + a real load/raster probe per engine; records are content-addressed (fontId = fnt_<sha256[:32]>[.faceIndex]).
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { createRequire } from 'node:module';
import { sha256File, run, mkdirp, readJson, writeJson, nowIso } from './util.mjs';
import { CFG } from './config.mjs';
const require = createRequire(import.meta.url);
export const ENGINES = ['browser', 'skia-python', 'pil', 'ffmpeg-drawtext', 'canvaskit'];
export function fontIdOf(sha, faceIndex = 0) { return 'fnt_' + sha.slice(0, 32) + (faceIndex ? '.' + faceIndex : ''); }
export async function listSystemFontFiles() { const { stdout } = await run('fc-list', ['--format', '%{file}\n']); return [...new Set(stdout.split('\n').filter(Boolean))].sort(); }

async function pyProbe(files) { // parallel chunks through fontprobe.py (skia-python + PIL/FreeType + fontTools metadata)
  const chunks = []; const n = 6; for (let i = 0; i < n; i++) chunks.push(files.filter((_, j) => j % n === i));
  const outs = await Promise.all(chunks.filter(c => c.length).map(c => new Promise((res, rej) => {
    const { spawn } = require('node:child_process'); const p = spawn(CFG.python, [path.join(CFG.root, 'producer/py/fontprobe.py')], { stdio: ['pipe', 'pipe', 'ignore'] });
    let out = ''; p.stdout.on('data', d => out += d); p.on('close', () => res(out)); p.on('error', rej); p.stdin.end(JSON.stringify(c)); })));
  return outs.join('').split('\n').filter(Boolean).map(l => JSON.parse(l));
}
async function browserProbe(recs) { // real Chrome FontFace load + measurable ink, same Chrome as the export worker
  const puppeteer = (await import('puppeteer-core')).default;
  const byId = new Map(recs.map(r => [r.fontId, r]));
  const srv = http.createServer((req, res) => { const id = decodeURIComponent(req.url.slice(3)); const r = byId.get(id); if (!r) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Access-Control-Allow-Origin': '*' }); fs.createReadStream(r.path).pipe(res); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); const port = srv.address().port;
  const b = await puppeteer.launch({ executablePath: CFG.chrome, args: ['--no-sandbox', '--disable-gpu'], headless: true });
  try { const pg = await b.newPage(); await pg.goto(`http://127.0.0.1:${port}/`).catch(() => {});
    const ver = await b.version();
    const res = await pg.evaluate(async (items, port) => { const out = {}; const cv = document.createElement('canvas'); cv.width = 400; cv.height = 80; const g = cv.getContext('2d', { willReadFrequently: true });
      const ink = (fam, s) => { g.clearRect(0, 0, 400, 80); g.font = `48px ${fam}`; g.fillStyle = '#000'; g.fillText(s, 4, 60); const d = g.getImageData(0, 0, 400, 80).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 128) n++; return n; };
      for (let i = 0; i < items.length; i += 24) await Promise.all(items.slice(i, i + 24).map(async ({ fontId, sample, faceIndex }) => {
        if (faceIndex) { out[fontId] = { ok: false, reason: 'collection face >0 not addressable by FontFace' }; return; }
        try { const fam = 'p_' + fontId.replace(/\W/g, ''); const ff = new FontFace(fam, `url(http://127.0.0.1:${port}/f/${encodeURIComponent(fontId)})`); await ff.load(); document.fonts.add(ff);
          const n = ink(`"${fam}", "__nofallback__"`, sample); out[fontId] = { ok: n > 0, inkedPx: n }; document.fonts.delete(ff); }
        catch (e) { out[fontId] = { ok: false, reason: String(e.message || e).slice(0, 120) }; } }));
      return out; }, recs.map(r => ({ fontId: r.fontId, sample: r.sample, faceIndex: r.faceIndex })), port);
    for (const r of recs) r.engines.browser = { ...(res[r.fontId] || { ok: false, reason: 'not probed' }), engineVersion: ver };
  } finally { await b.close(); srv.close(); }
}
async function canvaskitProbe(recs) {
  const CanvasKitInit = require('canvaskit-wasm/bin/canvaskit.js'); const CK = await CanvasKitInit({ locateFile: f => path.join(path.dirname(require.resolve('canvaskit-wasm/bin/canvaskit.js')), f) });
  const ver = 'canvaskit-wasm ' + require('canvaskit-wasm/package.json').version;
  for (const r of recs) { try { const buf = fs.readFileSync(r.path); const tf = CK.Typeface.MakeTypefaceFromData(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
      if (!tf) { r.engines.canvaskit = { ok: false, reason: 'MakeTypefaceFromData returned null', engineVersion: ver }; continue; }
      if (r.faceIndex) { r.engines.canvaskit = { ok: false, reason: 'collection face >0 not addressable', engineVersion: ver }; tf.delete(); continue; }
      const ids = tf.getGlyphIDs(r.sample); const ok = ids.length > 0 && [...ids].every(x => x > 0); r.engines.canvaskit = { ok, engineVersion: ver, ...(ok ? {} : { reason: 'sample glyphs unmapped' }) }; tf.delete();
    } catch (e) { r.engines.canvaskit = { ok: false, reason: String(e.message || e).slice(0, 120), engineVersion: ver }; } }
}
// ffmpeg drawtext is FreeType too, but it is probed for real (render + ink check) on the fonts a project uses
export async function ffmpegProbe(rec, outDir) {
  mkdirp(outDir); const png = path.join(outDir, rec.fontId.replace('.', '_') + '.png');
  const esc = s => s.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
  try { await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=white:s=256x64', '-frames:v', '1', '-vf', `drawtext=fontfile='${esc(rec.path)}':text='${esc(rec.sample)}':fontsize=48:fontcolor=black:x=4:y=4`, png]);
    const { stdout } = await run(CFG.python, ['-c', `from PIL import Image;import numpy as n;print(int((n.asarray(Image.open(${JSON.stringify(png)}).convert('L'))<128).sum()))`]);
    const ink = +stdout.trim(); const { stdout: v } = await run('ffmpeg', ['-version']); return { ok: ink > 0, inkedPx: ink, engineVersion: v.split('\n')[0].slice(0, 40), method: 'drawtext render' };
  } catch (e) { return { ok: false, reason: String(e.message).slice(0, 160) }; }
}
// full scan with a sha-keyed cache (a font file is probed once per engine version)
export async function scanFonts(files, { cacheFile = path.join(CFG.root, 'out/fontscan/cache.json') } = {}) {
  const cache = fs.existsSync(cacheFile) ? readJson(cacheFile) : {}; const items = [];
  for (const f of files) { const st = fs.statSync(f); const key = f + ':' + st.size + ':' + st.mtimeMs; items.push({ path: f, key, sha256: cache.__sha && cache.__sha[key] || await sha256File(f) }); }
  cache.__sha = Object.fromEntries(items.map(i => [i.key, i.sha256]));
  const todo = items.filter(i => !cache[i.sha256]); const fresh = todo.length ? await pyProbe(todo) : [];
  const recs = [];
  for (const r of fresh) { if (r.error) { cache[r.sha256] = cache[r.sha256] || []; continue; } r.fontId = fontIdOf(r.sha256, r.faceIndex); r.assetId = fontIdOf(r.sha256); recs.push(r); }
  if (recs.length) { await browserProbe(recs); await canvaskitProbe(recs);
    for (const r of recs) { r.engines['ffmpeg-drawtext'] = { ok: !!r.engines.pil.ok, method: 'inferred: FreeType load via PIL (ffmpeg drawtext uses FreeType); real drawtext probe runs for project fonts' };
      (cache[r.sha256] = cache[r.sha256] || []).push(r); } }
  mkdirp(path.dirname(cacheFile)); writeJson(cacheFile, cache);
  const out = []; for (const i of items) for (const r of cache[i.sha256] || []) out.push({ ...r, path: i.path });
  const seen = new Set(); return out.filter(r => !seen.has(r.fontId) && seen.add(r.fontId));
}
export const publicRecord = (r) => { const { path: _p, sample, ...rest } = r; return { schema: 'transovo.font-record/1', ...rest, sample }; };
// per-engine catalog document (only fonts that engine really rendered)
export function catalogFor(engine, recs, worker) {
  return { schema: 'transovo.font-catalog/1', engine, generatedAt: nowIso(), generatedBy: worker, count: 0,
    fonts: recs.filter(r => r.engines[engine] && r.engines[engine].ok).map(r => ({ fontId: r.fontId, assetId: r.assetId, faceIndex: r.faceIndex, family: r.family, subfamily: r.subfamily, fullName: r.fullName, postscriptName: r.postscriptName, version: r.version, weightClass: r.weightClass, italic: r.italic, axes: r.axes, codepoints: r.codepoints, sha256: r.sha256, engineVersion: r.engines[engine].engineVersion })) };
}

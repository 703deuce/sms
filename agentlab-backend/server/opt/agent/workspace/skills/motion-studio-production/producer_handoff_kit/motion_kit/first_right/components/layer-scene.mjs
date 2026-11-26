// layer-scene.mjs — adapters from the layout plan + tested pieces to the editable layer scene (transovo.layer-scene/1).
//  - piecesToLayers(layout, sceneId, content, style): layer dicts (text, plates, media) placed in their layout.json slots,
//    timed from the word anchors, with lint metadata (allowOverlap / faces / plateFor) carried in `lint`.
//  - fitLayerScene(spec, {fonts}): fits every text layer in headless Chrome with the real font files (same browser engine as the
//    runtime), sets text.fontSize to the fitted size and text.minSize to the readable floor, so the runtime's own auto-fit can
//    never shrink below readable. Returns {spec, errors}; an error means "shorten the line or widen the box", never "go smaller".
// CLI: node components/layer-scene.mjs fit <spec.json> --fonts display=/a.ttf,label=/b.ttf [--out fitted.json]
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(process.env.MS_PUPPETEER_FROM || '/workspace/motion_engines/_capture/package.json');
require(path.join(HERE, 'ms-core.js')); const C = globalThis.MSCore;
const TEXT = new Set(['title', 'number', 'lowerThird', 'label', 'caption', 'text', 'kicker', 'source']);

/**
 * content[id] = { text, label?, role?, src?, keyframes?, lines? } ; style[kind] = { font:'display'|'label' (theme token), weight, color,
 *   sizeRange:[min,max], lineHeight, letterSpacing, align, transform, plate?:{fill, padX, padY, radius}, numberShare?, labelStyle? }
 */
export function piecesToLayers(layout, sceneId, content, style) {
  const S = layout.scenes.find(s => s.sceneId === sceneId); if (!S) throw new Error('no scene ' + sceneId);
  const layers = [];
  const timing = (l, extra = {}) => ({ startMs: l.window.inMs, ...(l.window.outMs < S.durationMs ? { endMs: l.window.outMs } : {}), ...extra });
  const lintOf = l => { const m = {}; if (l.allowOverlap) m.allowOverlap = l.allowOverlap; if (l.faces) m.faces = l.faces; if (l.role) m.role = l.role; if (l.plateFor) m.plateFor = l.plateFor; return m; };
  const text = (id, box, value, st, l, keyframes, maxLines) => ({ id, name: id, kind: 'text', box, ...timing(l), ...(keyframes ? { keyframes } : {}), lint: lintOf(l),
    text: { value, fontSize: st.sizeRange[1], minSize: st.sizeRange[0], sizeRange: st.sizeRange, color: st.color, font: st.font, align: st.align || 'left', lineHeight: st.lineHeight ?? 1.05,
      letterSpacing: st.letterSpacing ?? 0, maxLines: maxLines || st.maxLines || 1, maxCharsPerLine: 80, transform: st.transform || 'none', weight: st.weight || 400 } });
  for (const l of S.layers) {
    const c = content[l.id]; if (!c) continue; const st = style[l.kind] || {}; const b = l.box;
    if (l.kind === 'image' || l.kind === 'video' || l.kind === 'media' || l.kind === 'photo') {
      const kind = c.kind || (/\.(mp4|webm|mov)$/i.test(c.src) ? 'video' : 'image');
      layers.push({ id: l.id, name: l.id, kind, box: b, ...timing(l), ...(c.keyframes ? { keyframes: c.keyframes } : {}), lint: lintOf(l), [kind]: { src: c.src, fit: 'cover', ...(c.inSec ? { inSec: c.inSec } : {}) } }); continue; }
    if (!TEXT.has(l.kind)) continue;
    if (st.plate) layers.push({ id: l.id + '_plate', name: l.id + ' plate', kind: 'shape', box: b, ...timing(l), ...(c.keyframes?.opacity ? { keyframes: { opacity: c.keyframes.opacity } } : {}),
      lint: { plateFor: l.kind === 'lowerThird' ? [l.id, l.id + '_role'] : [l.id] }, shape: { type: 'rect', fill: st.plate.fill, radius: st.plate.radius || 0 } });
    const px = st.plate?.padX || 0, py = st.plate?.padY || 0; const inner = { x: b.x + px, y: b.y + py, w: b.w - 2 * px, h: b.h - 2 * py };
    if (l.kind === 'number' && c.label) { const nh = Math.floor(inner.h * (st.numberShare || 0.68));
      layers.push(text(l.id, { ...inner, h: nh }, c.text, st, l, c.keyframes, 1));
      layers.push(text(l.id + '_label', { ...inner, y: inner.y + nh, h: inner.h - nh }, c.label, st.labelStyle || style.label, l, c.labelKeyframes || c.keyframes, c.labelLines || 2)); }
    else if (l.kind === 'lowerThird' && c.role) { const nh = Math.floor(inner.h * (st.nameShare || 0.58));
      layers.push(text(l.id, { ...inner, h: nh }, c.text, st, l, c.keyframes, 1));
      layers.push(text(l.id + '_role', { ...inner, y: inner.y + nh, h: inner.h - nh }, c.role, st.roleStyle || style.label, l, c.keyframes, 1)); }
    else layers.push(text(l.id, inner, c.text, st, l, c.keyframes, c.lines || l.lines));
  }
  return layers;
}

/** Fit every text layer with the real fonts. fonts: { token: '/abs/font.ttf' }. */
export async function fitLayerScene(spec, { fonts, chrome = process.env.MS_CHROME || '/usr/bin/google-chrome' } = {}) {
  const { launch } = require('puppeteer-core'); const W = spec.width, H = spec.height;
  const srv = http.createServer((q, r) => { if (q.url === '/__blank') { r.writeHead(200, { 'Content-Type': 'text/html' }); return r.end('<!doctype html><body></body>'); } const tok = decodeURIComponent(q.url.slice(1)); const f = fonts[tok]; if (!f) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': 'font/ttf', 'Access-Control-Allow-Origin': '*' }); fs.createReadStream(f).pipe(r); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${srv.address().port}`;
  const b = await launch({ executablePath: chrome, headless: true, args: ['--no-sandbox', '--font-render-hinting=none'] });
  try {
    const p = await b.newPage(); await p.goto(base + '/__blank');
    await p.addScriptTag({ content: fs.readFileSync(path.join(HERE, 'ms-core.js'), 'utf8') });
    const res = await p.evaluate(async (spec, base, toks, W, H) => {
      for (const t of toks) { const ff = new FontFace('ms_' + t, `url(${base}/${encodeURIComponent(t)})`); document.fonts.add(ff); await ff.load(); }
      const out = [];
      for (const l of spec.layers) { if (l.kind !== 'text') continue; const t = l.text;
        const range = t.sizeRange || [t.minSize || 0, t.fontSize];
        const r = MSCore.fitText({ text: t.value, font: { family: `"ms_${t.font || 'display'}"`, weight: t.weight, lineHeight: t.lineHeight, letterSpacing: t.letterSpacing, transform: t.transform },
          box: { w: l.box.w, h: l.box.h }, sizeRange: range, maxLines: t.maxLines || 1, frame: { W, H }, role: l.lint?.role === 'caption' ? 'caption' : l.lint?.role === 'credit' ? 'credit' : undefined });
        out.push({ id: l.id, r }); }
      return out; }, spec, base, Object.keys(fonts), W, H);
    const errors = []; const byId = new Map(res.map(x => [x.id, x.r]));
    const layers = spec.layers.map(l => { if (l.kind !== 'text') return l; const r = byId.get(l.id);
      if (!r.ok) { errors.push(`${l.id}: ${r.error}: ${r.message}`); return l; }
      const t = { ...l.text, fontSize: Math.floor(r.size * 2) / 2, minSize: Math.ceil(r.floorSize) }; delete t.sizeRange;
      if (r.lines.length > 1 && !String(l.text.value).includes('\n')) t.value = r.lines.join('\n');   // lock the planned line breaks
      return { ...l, text: t, lint: { ...(l.lint || {}), fit: { size: r.size, lines: r.lines.length, capPx: +r.capPx.toFixed(1), floor: r.floorSize } } }; });
    return { spec: { ...spec, layers }, errors };
  } finally { await b.close(); srv.close(); }
}

if (import.meta.url === `file://${process.argv[1]}` && process.argv[2] === 'fit') {
  const a = process.argv.slice(3); const src = a[0]; const opt = {}; for (let i = 1; i < a.length; i++) opt[a[i].replace(/^--/, '')] = a[++i];
  const fonts = Object.fromEntries((opt.fonts || '').split(',').filter(Boolean).map(x => x.split('=')));
  const spec = JSON.parse(fs.readFileSync(src, 'utf8')); const { spec: out, errors } = await fitLayerScene(spec, { fonts });
  for (const e of errors) console.log('✗ ' + e); for (const l of out.layers) if (l.lint?.fit) console.log(`  ${l.id.padEnd(18)} ${l.text.fontSize}px  cap ${l.lint.fit.capPx}px  ${l.lint.fit.lines} line(s)`);
  if (opt.out) fs.writeFileSync(opt.out, JSON.stringify(out, null, 1)); process.exit(errors.length ? 1 : 0);
}

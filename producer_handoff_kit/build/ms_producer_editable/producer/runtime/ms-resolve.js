// ms-resolve.js: the ONE property resolver + static validator, shared by browser preview, export worker and Python/Skia adapters.
// Contract: transovo.editable-elements/1, transovo.motion-theme/1, transovo.edit-patch/1 (see docs/CONTRACT.md).
// Pure ES module: no DOM, no Node APIs.
export const CONTRACT = 'transovo.editable-elements/1';
const isObj = o => o && typeof o === 'object' && !Array.isArray(o);
const clone = o => o === undefined ? undefined : JSON.parse(JSON.stringify(o));
export function merge(a, b) { if (!isObj(b)) return clone(b); const o = isObj(a) ? clone(a) : {}; for (const k of Object.keys(b)) { if (b[k] === null) { delete o[k]; continue; } o[k] = isObj(b[k]) && isObj(o[k]) ? merge(o[k], b[k]) : clone(b[k]); } return o; }
export const getPath = (o, p) => p.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
export function canon(v) { if (v === undefined || v === null || typeof v !== 'object') return JSON.stringify(v ?? null); if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']'; return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}'; }
// tiny non-crypto hash for change detection inside the runtime (workers use sha256 over canon())
export function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }
// ---------- colour ----------
export const hex2rgb = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h); if (!m) throw new Error('bad colour ' + h); const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
export const rgb2hex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
export const rgba = (h, a) => { const [r, g, b] = hex2rgb(h); return `rgba(${r},${g},${b},${a})`; };
const s2l = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const l2s = v => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(0, v), 1 / 2.4) - 0.055);
export function toOklch(h) { const [r, g, b] = hex2rgb(h).map(s2l);
  const l = Math.cbrt(0.4122214708*r+0.5363325363*g+0.0514459929*b), m = Math.cbrt(0.2119034982*r+0.6806995451*g+0.1073969566*b), s = Math.cbrt(0.0883024619*r+0.2817188376*g+0.6299787005*b);
  const L = 0.2104542553*l+0.7936177850*m-0.0040720468*s, A = 1.9779984951*l-2.4285922050*m+0.4505937099*s, B = 0.0259040371*l+0.7827717662*m-0.8086757660*s;
  return [L, Math.hypot(A, B), Math.atan2(B, A)]; }
export function fromOklch([L, C, hh]) { const A = C * Math.cos(hh), B = C * Math.sin(hh);
  const l = (L+0.3963377774*A+0.2158037573*B)**3, m = (L-0.1055613458*A-0.0638541728*B)**3, s = (L-0.0894841775*A-1.2914855480*B)**3;
  return rgb2hex([4.0767416621*l-3.3077115913*m+0.2309699292*s, -1.2684380046*l+2.6097574011*m-0.3413193965*s, -0.0041960863*l-0.7034186147*m+1.7076147010*s].map(l2s)); }
// derived colour: keeps the designer's relationship (OKLCH offset) to its source token; exact original when the source is untouched
export function derive(spec, srcValue) {
  if (srcValue.toUpperCase() === spec.designFrom.toUpperCase()) return spec.designValue.toUpperCase();
  const a = toOklch(spec.designFrom), b = toOklch(spec.designValue), n = toOklch(srcValue);
  const ratio = a[1] > 1e-4 ? b[1] / a[1] : 1;
  return fromOklch([Math.max(0, Math.min(1, n[0] + (b[0] - a[0]))), n[1] * ratio, n[2] + (b[2] - a[2])]); }
const lum = h => { const [r, g, b] = hex2rgb(h).map(s2l); return 0.2126*r + 0.7152*g + 0.0722*b; };
export const blend = (fg, a, bg) => { const f = hex2rgb(fg), b = hex2rgb(bg); return rgb2hex(f.map((v, i) => v * a + b[i] * (1 - a))); };
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// ---------- fonts ----------
export function covers(fontRec, text) { // fontRec.coverage = [[start,end],...] (unicode code points, from fontTools cmap)
  const missing = new Set(); if (!fontRec || !fontRec.coverage) return [];
  for (const ch of text) { const cp = ch.codePointAt(0); if (cp <= 32 || cp === 0xA0 || cp === 0x200B || cp === 10) continue;
    let lo = 0, hi = fontRec.coverage.length - 1, ok = false; while (lo <= hi) { const mid = (lo + hi) >> 1, [s, e] = fontRec.coverage[mid]; if (cp < s) hi = mid - 1; else if (cp > e) lo = mid + 1; else { ok = true; break; } }
    if (!ok) missing.add(ch); }
  return [...missing]; }
export function weightOk(fontRec, w) { if (w == null) return true; const ax = (fontRec.axes || []).find(a => a.tag === 'wght'); if (ax) return w >= ax.min && w <= ax.max; return Math.abs((fontRec.weightClass || 400) - w) < 50; }
// a font selection is {faces:[fontId...], weight?, style?}: one family made of exact font files (engine-native, no preset library)
export function faceRecs(sel, fonts) { return ((sel && sel.faces) || []).map(id => fonts[id]).filter(Boolean); }
export function pickFace(recs, weight = 400, style = 'normal') { if (!recs.length) return null;
  const sc = r => (((r.italic ? 'italic' : 'normal') === style) ? 0 : 1000) + ((r.axes || []).find(a => a.tag === 'wght') && weight >= r.axes.find(a => a.tag === 'wght').min && weight <= r.axes.find(a => a.tag === 'wght').max ? 0 : Math.abs((r.weightClass || 400) - weight));
  return recs.slice().sort((a, b) => sc(a) - sc(b))[0]; }

// ---------- resolve ----------
// ctx: { mode: 'live'|'render', fonts: {fontId: record}, assets: {assetId: {mime,width,height,meta}}, sceneId }
export function resolve(manifest, theme, overrides = {}, ctx = {}) {
  const issues = []; const sid = manifest.sceneId; const mode = ctx.mode || 'render';
  const push = (severity, code, o = {}) => issues.push({ severity, code, scene: sid, ...o });
  const T = merge(theme, overrides.theme || {});
  const so = (overrides.scenes || {})[sid] || {};
  // patch-shape checks: unknown/protected/AI-only properties never reach the scene
  const elIndex = Object.fromEntries(manifest.elements.map(e => [e.id, e]));
  const protectedNames = new Set((manifest.protected || []).flatMap(p => p.props || []));
  for (const [eid, props] of Object.entries(so.elements || {})) {
    const el = elIndex[eid]; if (!el) { push('error', 'UNKNOWN_ELEMENT', { element: eid, message: `no editable element "${eid}" in ${sid}` }); continue; }
    for (const pn of Object.keys(props || {})) {
      const ps = el.properties[pn];
      if (!ps) { const ai = (el.aiEditable || []).find(a => (a.prop || a) === pn);
        if (protectedNames.has(pn) || protectedNames.has(eid + '.' + pn)) push('error', 'PROTECTED_PROPERTY', { element: eid, prop: pn, message: `${eid}.${pn} is protected (animation/camera/engine internals)` });
        else if (ai) push('error', 'AI_REQUIRED', { element: eid, prop: pn, message: `${eid}.${pn} needs a creative (AI) job` });
        else push('error', 'UNSUPPORTED_PROPERTY', { element: eid, prop: pn, message: `${eid}.${pn} is not an editable property of this scene` });
        continue; }
      if (mode === 'live' && ps.tier !== 'live_editable') push('error', 'TIER_NOT_LIVE', { element: eid, prop: pn, message: `${eid}.${pn} is ${ps.tier}; it needs a worker render` });
    } }
  for (const k of Object.keys(so.render || {})) if (!(manifest.renderSettings || {})[k]) push('error', 'UNSUPPORTED_PROPERTY', { prop: 'render.' + k, message: `render setting ${k} not declared` });
  else if (mode === 'live') push('error', 'TIER_NOT_LIVE', { prop: 'render.' + k, message: 'render settings apply on the worker only' });
  for (const k of Object.keys(so.tokens || {})) if (!/^(colors|fonts)\.[a-zA-Z0-9]+$/.test(k) || getPath(T, k) === undefined) push('error', 'UNKNOWN_TOKEN', { token: k });
  // tokens: theme <- scene token overrides
  const tokVal = v => (isObj(v) && 'value' in v ? v.value : v);
  const colors = {}; for (const k of Object.keys(T.colors || {})) colors[k] = tokVal(T.colors[k]);
  const fonts = {}; for (const k of Object.keys(T.fonts || {})) fonts[k] = clone(T.fonts[k]);
  for (const [k, v] of Object.entries(so.tokens || {})) { const [g, n] = k.split('.'); if (g === 'colors') colors[n] = tokVal(v); else if (g === 'fonts') fonts[n] = clone(v); }
  for (const [k, v] of Object.entries(colors)) if (!/^#[0-9a-f]{6}$/i.test(v || '')) push('error', 'TYPE', { token: 'colors.' + k, message: 'colour must be #RRGGBB' });
  const c = {}; for (const [k, v] of Object.entries(colors)) c[k] = /^#[0-9a-f]{6}$/i.test(v || '') ? v.toUpperCase() : '#FF00FF';
  for (const [name, spec] of Object.entries(manifest.derivedTokens || {})) { const src = spec.from.startsWith('colors.') ? c[spec.from.slice(7)] : c[spec.from]; c[name] = derive(spec, src || spec.designFrom); }
  const fontIssue = (sel, where, needItalic) => { if (!sel) return; needItalic = needItalic || sel.style === 'italic'; if (!Array.isArray(sel.faces) || !sel.faces.length) return push('error', 'TYPE', { where, message: 'font must be {faces:[fontId...], weight?}' });
    const eng = manifest.fontEngine; const recs = [];
    for (const id of sel.faces) { const rec = (ctx.fonts || {})[id];
      if (!rec) { push('error', 'FONT_MISSING', { where, message: `font ${id} is not in the storage font index` }); continue; }
      if (eng && !(rec.engines && rec.engines[eng] && rec.engines[eng].ok)) push('error', 'FONT_ENGINE_UNSUPPORTED', { where, message: `${rec.fullName || id} cannot be rendered by engine ${eng}` });
      recs.push(rec); }
    if (recs.length && !recs.some(r => weightOk(r, sel.weight))) push('warning', 'FONT_WEIGHT_UNAVAILABLE', { where, message: `${recs[0].family} has no weight ${sel.weight}; the engine would synthesize it` });
    if (needItalic && recs.length && !recs.some(r => r.italic || (r.axes || []).some(a => a.tag === 'ital' || a.tag === 'slnt'))) push('warning', 'FONT_STYLE_UNAVAILABLE', { where, message: `${recs[0].family} has no italic face; the engine would slant it` }); };
  for (const k of (manifest.fontTokensUsed || []).map(s => s.split('.')[1])) fontIssue(fonts[k], 'fonts.' + k, (manifest.italicTokens || []).includes('fonts.' + k));
  // elements
  const e = {};
  for (const el of manifest.elements) {
    const eo = (so.elements || {})[el.id] || {}; const out = {};
    for (const [pn, ps] of Object.entries(el.properties)) {
      let v = eo[pn], src = 'element';
      if (v === undefined && ps.bind) { const [g, n] = ps.bind.split('.'); v = g === 'colors' ? c[n] : g === 'fonts' ? clone(fonts[n]) : g === 'derived' ? c[n] : undefined; src = 'token:' + ps.bind; }
      if (v === undefined && ps.fallbackBind) { v = clone(getPath(T, ps.fallbackBind)); src = 'token:' + ps.fallbackBind; }
      if (v === undefined) { v = clone(ps.default); src = 'default'; }
      out[pn] = checkProp(el, pn, ps, v, eo[pn] !== undefined, push); (out.__src = out.__src || {})[pn] = src;
    }
    // font + glyph coverage for every text property rendered with this element's font
    for (const [pn, ps] of Object.entries(el.properties)) if (ps.type === 'font' && eo[pn] !== undefined) fontIssue(out[pn], el.id + '.' + pn, ps.requiresItalic);
    for (const [pn, ps] of Object.entries(el.properties)) { const fsel = ps.type === 'text' ? out[ps.font || 'font'] : null; if (!fsel || !fsel.faces) continue;
      const rec = pickFace(faceRecs(fsel, ctx.fonts || {}), fsel.weight, ps.fontStyle || 'normal'); const txt = ps.transform === 'uppercase' ? String(out[pn]).toUpperCase() : String(out[pn]);
      const miss = covers(rec, txt); if (miss.length) push('error', 'GLYPH_MISSING', { element: el.id, prop: pn, message: `${rec.fullName} has no glyph for: ${miss.join(' ')}`, chars: miss }); }
    // images
    for (const [pn, ps] of Object.entries(el.properties)) if (ps.type === 'image' && out[pn] && out[pn].asset) {
      const a = (ctx.assets || {})[out[pn].asset];
      if (!a) { push('error', 'ASSET_MISSING', { element: el.id, prop: pn, message: `asset ${out[pn].asset} not found in storage` }); continue; }
      if (ps.formats && !ps.formats.includes(a.mime)) push('error', 'ASSET_FORMAT', { element: el.id, prop: pn, message: `${a.mime} not allowed (${ps.formats.join(', ')})` });
      if (a.mime === 'image/svg+xml' && !(a.meta && a.meta.svgSafe)) push('error', 'SVG_UNSAFE', { element: el.id, prop: pn, message: 'SVG must be outlined: no <text>, no external refs, no scripts' });
      if (ps.minWidth && a.width && (a.width < ps.minWidth || a.height < ps.minHeight)) push('error', 'IMAGE_TOO_SMALL', { element: el.id, prop: pn, message: `${a.width}x${a.height} < ${ps.minWidth}x${ps.minHeight}` });
      if (ps.aspect && a.width) { const ar = a.width / a.height; if (Math.abs(ar - ps.aspect) / ps.aspect > 0.01) push('info', 'IMAGE_CROPPED', { element: el.id, prop: pn, message: `cover-cropped from ${ar.toFixed(3)} to ${ps.aspect.toFixed(3)} around focalPoint` }); }
    }
    e[el.id] = out;
  }
  // colour contrast (declared pairs; layout-only contrast is added by the engine adapter)
  for (const cp of manifest.contrast || []) {
    const ref = r => r.startsWith('el:') ? getPath(e, r.slice(3)) : c[r.replace(/^(colors|derived)\./, '')];
    let fg = ref(cp.fg); if (!fg || !/^#/.test(fg)) continue; const bgs = cp.bg.map(ref).filter(Boolean);
    const worst = Math.min(...bgs.map(b => contrast(cp.fgAlpha ? blend(fg, cp.fgAlpha, b) : fg, cp.bgBlend ? blend(cp.bgBlend.color ? ref(cp.bgBlend.color) : b, cp.bgBlend.alpha, b) : b)));
    const min = Math.min(cp.min, cp.designBaseline ?? 99);
    if (worst < min) push(worst < 2 ? 'error' : 'warning', 'CONTRAST_LOW', { element: cp.element, message: `contrast ${worst.toFixed(2)}:1 < ${min}:1`, ratio: +worst.toFixed(2) });
  }
  const resolved = { sceneId: sid, colors: c, fonts, elements: e, render: merge((manifest.renderSettings ? Object.fromEntries(Object.entries(manifest.renderSettings).map(([k, v]) => [k, v.default])) : {}), so.render || {}), brand: clone(T.brand || {}) };
  const strip = o => JSON.parse(JSON.stringify(o, (k, v) => (k === '__src' ? undefined : v)));
  resolved.hash = fnv(canon(strip(resolved)));
  return { ...resolved, issues };
}
function checkProp(el, pn, ps, v, overridden, push) {
  const at = { element: el.id, prop: pn };
  switch (ps.type) {
    case 'text': { if (typeof v !== 'string') { push('error', 'TYPE', at); return ps.default; }
      const lines = v.split('\n'); if (ps.maxLines && lines.length > ps.maxLines) push('error', 'TEXT_LINES', { ...at, message: `${lines.length} lines > ${ps.maxLines}` });
      const longest = Math.max(...lines.map(l => [...l].length)); if (ps.maxCharsPerLine && longest > ps.maxCharsPerLine) push('error', 'TEXT_TOO_LONG', { ...at, message: `${longest} chars/line > ${ps.maxCharsPerLine}` });
      if (ps.maxChars && [...v].length > ps.maxChars) push('error', 'TEXT_TOO_LONG', { ...at, message: `${[...v].length} chars > ${ps.maxChars}` });
      if (!v.trim() && !ps.allowEmpty) push('error', 'TEXT_EMPTY', at);
      if (ps.spokenInNarration && overridden && v !== ps.default) push('warning', 'NARRATION_MISMATCH', { ...at, message: 'on-screen text no longer matches the narration, which still says the original; re-voicing is an AI job' });
      return v; }
    case 'number': if (typeof v !== 'number' || !isFinite(v)) { push('error', 'TYPE', at); return ps.default; }
      if (v < ps.min || v > ps.max) { push('error', 'RANGE', { ...at, message: `${v} outside [${ps.min}, ${ps.max}]` }); return Math.max(ps.min, Math.min(ps.max, v)); } return v;
    case 'color': if (!/^#[0-9a-f]{6}$/i.test(v || '')) { push('error', 'TYPE', { ...at, message: 'colour must be #RRGGBB' }); return ps.default || '#FF00FF'; } return v.toUpperCase();
    case 'enum': if (!ps.enum.includes(v)) { push('error', 'ENUM', { ...at, message: `${v} not in [${ps.enum.join(', ')}]` }); return ps.default; } return v;
    case 'boolean': if (typeof v !== 'boolean') { push('error', 'TYPE', at); return ps.default; } return v;
    case 'point': if (!v || typeof v.x !== 'number' || typeof v.y !== 'number' || v.x < 0 || v.x > 1 || v.y < 0 || v.y > 1) { push('error', 'RANGE', { ...at, message: 'point x,y must be within 0..1' }); return ps.default; } return v;
    case 'font': if (!v || !Array.isArray(v.faces)) { push('error', 'TYPE', { ...at, message: 'font must be {faces:[fontId...], weight?}' }); return ps.default; }
      if (v.weight != null && (typeof v.weight !== 'number' || v.weight < 1 || v.weight > 1000)) push('error', 'RANGE', { ...at, message: 'weight must be 1..1000' }); return v;
    case 'image': if (v !== null && (!v || typeof v.asset !== 'string')) { push('error', 'TYPE', { ...at, message: 'image must be {asset: assetId}' }); return ps.default; } return v;
    default: return v;
  }
}
// collect every asset/font id a resolved scene needs (for materialisation / missing-asset checks)
export function referencedIds(resolvedScene) { const ids = new Set(); JSON.stringify(resolvedScene, (k, v) => { if (k === 'asset' && typeof v === 'string') ids.add(v); if (k === 'faces' && Array.isArray(v)) v.forEach(x => ids.add(x)); return v; }); return [...ids]; }

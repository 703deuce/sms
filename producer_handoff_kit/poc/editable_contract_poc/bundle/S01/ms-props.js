// ms-props.js — Motion Studio editable-props runtime for this scene bundle (POC, contract v0.1).
// The SAME file runs in the Transovo browser preview and in the headless export worker (parity).
// Host contract: before load, the host sets window.__MS_HOST = { theme, overrides, assetUrls }
//   theme      : project theme.json (design tokens)
//   overrides  : { theme?: <partial theme>, scenes: { <sceneId>: { tokens?: {"colors.accent": "#..."}, elements?: { <elementId>: { <prop>: value } } } } }
//   assetUrls  : { <Transovo asset id>: <URL the host minted for this session> }  (never stored in the project)
// Exposes on window.__scene (in addition to fps/duration/seek from common.js):
//   setProps(patch) -> { ok, issues, applyMs }   merges patch into overrides, re-resolves, updates without reload
//   getProps()      -> resolved props            validate() -> issues[]      describe() -> element bounds at hold frame
const MS = {};
const H = () => window.__MS_HOST || (window.__MS_HOST = { theme: null, overrides: {}, assetUrls: {} });
let MAN = null, THEME = null, OVR = null, P = null, attached = null, lastT = 0;
const splits = [];
const SID = () => MAN.sceneId;

// ---------- small utils ----------
const clone = o => JSON.parse(JSON.stringify(o ?? null));
const isObj = o => o && typeof o === 'object' && !Array.isArray(o);
// merge patch; a null value removes the override (reverts to token/default)
function merge(a, b) { if (!isObj(b)) return clone(b); const o = isObj(a) ? clone(a) : {}; for (const k of Object.keys(b)) { if (b[k] === null) { delete o[k]; continue; } o[k] = (isObj(b[k]) && isObj(o[k])) ? merge(o[k], b[k]) : clone(b[k]); } return o; }
const getPath = (o, p) => p.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hex2rgb = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h); if (!m) throw new Error('bad colour ' + h); const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const rgb2hex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
MS.rgba = (h, a) => { const [r, g, b] = hex2rgb(h); return `rgba(${r},${g},${b},${a})`; };
// OKLCH (Björn Ottosson's OKLab) for derived tokens
const s2l = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const l2s = v => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
function toOklch(h) { const [r, g, b] = hex2rgb(h).map(s2l);
  const l = Math.cbrt(0.4122214708*r+0.5363325363*g+0.0514459929*b), m = Math.cbrt(0.2119034982*r+0.6806995451*g+0.1073969566*b), s = Math.cbrt(0.0883024619*r+0.2817188376*g+0.6299787005*b);
  const L = 0.2104542553*l+0.7936177850*m-0.0040720468*s, A = 1.9779984951*l-2.4285922050*m+0.4505937099*s, B = 0.0259040371*l+0.7827717662*m-0.8086757660*s;
  return [L, Math.hypot(A, B), Math.atan2(B, A)]; }
function fromOklch([L, C, hh]) { const A = C * Math.cos(hh), B = C * Math.sin(hh);
  const l = (L+0.3963377774*A+0.2158037573*B)**3, m = (L-0.1055613458*A-0.0638541728*B)**3, s = (L-0.0894841775*A-1.2914855480*B)**3;
  return rgb2hex([4.0767416621*l-3.3077115913*m+0.2309699292*s, -1.2684380046*l+2.6097574011*m-0.3413193965*s, -0.0041960863*l-0.7034186147*m+1.7076147010*s].map(l2s)); }
function derive(spec, tokens) { const src = getPath(tokens, spec.from);
  if (src.toUpperCase() === spec.designFrom.toUpperCase()) return spec.designValue;      // untouched source -> exact original literal
  const a = toOklch(spec.designFrom), b = toOklch(spec.designValue), n = toOklch(src);
  const ratio = a[1] > 1e-4 ? b[1] / a[1] : 1;
  return fromOklch([Math.max(0, Math.min(1, n[0] + (b[0] - a[0]))), n[1] * ratio, n[2] + (b[2] - a[2])]); }
function lum(h) { const [r, g, b] = hex2rgb(h).map(s2l); return 0.2126*r + 0.7152*g + 0.0722*b; }
function blend(fg, a, bg) { const f = hex2rgb(fg), b = hex2rgb(bg); return rgb2hex(f.map((v, i) => v * a + b[i] * (1 - a))); }
MS.contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// ---------- resolution: element override > scene token override > project theme (+ project theme patch) > manifest default ----------
function resolve() {
  const issues = [];
  const theme = merge(THEME, OVR.theme || {});
  const so = (OVR.scenes || {})[SID()] || {};
  const tokens = merge(theme, {}); for (const [k, v] of Object.entries(so.tokens || {})) { const ks = k.split('.'); let o = tokens; ks.slice(0, -1).forEach(x => o = o[x] = o[x] || {}); o[ks.at(-1)] = v; }
  const tok = p => { const v = getPath(tokens, p); return v && typeof v === 'object' && 'value' in v ? v.value : v; };
  const flat = { colors: {}, fonts: {} };
  for (const k of Object.keys(tokens.colors)) flat.colors[k] = tok('colors.' + k);
  for (const k of Object.keys(tokens.fonts)) flat.fonts[k] = tok('fonts.' + k);
  const c = { ...flat.colors };
  for (const [name, spec] of Object.entries(MAN.derivedTokens || {})) c[name] = derive(spec, flat);
  const fontOf = f => ({ ...f, family: `"ms_${f.asset}"` });
  const f = Object.fromEntries(Object.entries(flat.fonts).map(([k, v]) => [k, fontOf(v)]));
  const e = {};
  for (const el of MAN.elements) {
    const eo = (so.elements || {})[el.id] || {}; const out = {};
    for (const [pn, ps] of Object.entries(el.properties)) {
      let v = eo[pn]; let src = 'element';
      if (v === undefined && ps.bind) { v = getPath(flat, ps.bind); src = 'token:' + ps.bind; if (ps.bind in c) v = c[ps.bind]; }
      if (v === undefined) { v = clone(ps.default); src = 'default'; }
      if (eo[pn] !== undefined && ps.tier !== 'live_editable' && !(H().mode === 'render' && ps.tier === 'render_editable')) issues.push({ severity: 'error', code: 'TIER_NOT_LIVE', element: el.id, prop: pn, message: `${el.id}.${pn} is ${ps.tier}; it cannot be changed through setProps` });
      v = checkProp(el, pn, ps, v, issues);
      out[pn] = v; (out.__src = out.__src || {})[pn] = src;
    }
    e[el.id] = out;
  }
  // assets -> session URLs (host-minted); never paths or signed URLs inside the project
  const url = id => { const u = (H().assetUrls || {})[id]; if (!u) issues.push({ severity: 'error', code: 'ASSET_UNRESOLVED', asset: id, message: 'asset id not resolvable by host: ' + id }); return u; };
  e.portrait.src = url(e.portrait.image.asset);
  const logoAsset = e.logo.image?.asset || getPath(tokens, 'brand.logo.asset');
  e.logo.src = e.logo.visible && logoAsset ? url(logoAsset) : null;
  if (e.logo.visible && !logoAsset) issues.push({ severity: 'error', code: 'ASSET_MISSING', element: 'logo', message: 'logo is visible but no logo asset is set (element or theme.brand.logo)' });
  e.logo.assetId = logoAsset;
  for (const k of ['display', 'label', 'body']) { const fa = flat.fonts[k]; if (!(tokens.fontCatalog || []).some(x => x.asset === fa.asset)) issues.push({ severity: 'error', code: 'FONT_NOT_ALLOWED', token: 'fonts.' + k, message: fa.asset + ' is not in the project font catalog' }); }
  for (const el of ['title', 'pronunciation', 'location', 'year']) { const ff = e[el].font; if (ff && !(tokens.fontCatalog || []).some(x => x.asset === ff.asset)) issues.push({ severity: 'error', code: 'FONT_NOT_ALLOWED', element: el, message: ff.asset + ' is not in the project font catalog' }); }
  return { c, f, e, tokens, issues };
}
function checkProp(el, pn, ps, v, issues) {
  const at = { element: el.id, prop: pn };
  switch (ps.type) {
    case 'text': { if (typeof v !== 'string') { issues.push({ severity: 'error', code: 'TYPE', ...at }); return ps.default; }
      const lines = v.split('\n'); if (ps.maxLines && lines.length > ps.maxLines) issues.push({ severity: 'error', code: 'TEXT_LINES', ...at, message: `${lines.length} lines > ${ps.maxLines}` });
      const longest = Math.max(...lines.map(l => [...l].length)); if (ps.maxCharsPerLine && longest > ps.maxCharsPerLine) issues.push({ severity: 'error', code: 'TEXT_TOO_LONG', ...at, message: `${longest} chars/line > ${ps.maxCharsPerLine}` });
      if (ps.maxChars && [...v].length > ps.maxChars) issues.push({ severity: 'error', code: 'TEXT_TOO_LONG', ...at, message: `${[...v].length} chars > ${ps.maxChars}` });
      if (!v.trim() && !ps.allowEmpty) issues.push({ severity: 'error', code: 'TEXT_EMPTY', ...at });
      if (ps.spokenInNarration && v !== ps.default) issues.push({ severity: 'info', code: 'SPOKEN_TEXT_CHANGED', ...at, message: 'this text is also spoken in the narration; the voice-over is not changed (ai_editable)' });
      return v; }
    case 'number': { if (typeof v !== 'number' || !isFinite(v)) { issues.push({ severity: 'error', code: 'TYPE', ...at }); return ps.default; }
      if (v < ps.min || v > ps.max) { issues.push({ severity: 'warning', code: 'RANGE_CLAMPED', ...at, message: `${v} clamped to [${ps.min},${ps.max}]` }); v = Math.max(ps.min, Math.min(ps.max, v)); } return v; }
    case 'color': if (!/^#[0-9a-f]{6}$/i.test(v)) { issues.push({ severity: 'error', code: 'TYPE', ...at, message: 'colour must be #RRGGBB' }); return ps.default; } return v.toUpperCase();
    case 'enum': if (!ps.enum.includes(v)) { issues.push({ severity: 'error', code: 'ENUM', ...at, message: `${v} not in ${ps.enum}` }); return ps.default; } return v;
    case 'boolean': return !!v;
    default: return v;
  }
}

// ---------- assets / fonts ----------
const loadedFonts = new Map();
async function loadFonts(R) {
  const want = new Map();
  const add = fa => { const ent = (R.tokens.fontCatalog || []).find(x => x.asset === fa.asset); if (ent) want.set(fa.asset, ent); };
  for (const k of Object.keys(R.f)) add(R.f[k]);
  for (const el of Object.values(R.e)) if (el.font) add(el.font);
  const jobs = [];
  for (const [id, ent] of want) { if (loadedFonts.has(id)) continue; const u = (H().assetUrls || {});
    const faces = ent.faces.map(fc => { const url = u[fc.file]; if (!url) { R.issues.push({ severity: 'error', code: 'ASSET_UNRESOLVED', asset: fc.file }); return null; }
      const ff = new FontFace('ms_' + id, `url(${url})`, { weight: String(fc.weight), style: fc.style || 'normal' }); document.fonts.add(ff); return ff.load(); }).filter(Boolean);
    loadedFonts.set(id, ent); jobs.push(...faces); }
  await Promise.all(jobs);
  // weight coverage check (no faux bold)
  const chk = (fa, where) => { const ent = want.get(fa.asset); if (!ent) return; const ok = ent.faces.some(fc => { const [lo, hi] = String(fc.weight).split(' ').map(Number); return fa.weight >= lo && fa.weight <= (hi || lo); });
    if (!ok) R.issues.push({ severity: 'warning', code: 'FONT_WEIGHT_MISSING', where, message: `${fa.asset} has no face for weight ${fa.weight}; browser would synthesize it` }); };
  for (const k of Object.keys(R.f)) chk(R.f[k], 'fonts.' + k);
}
MS.coverCrop = (tex, img, aspect, fp) => { const ia = img.width / img.height; tex.repeat.set(1, 1); tex.offset.set(0, 0);
  if (Math.abs(ia - aspect) < 1e-3) return;                       // original 480x360 = 4:3 -> untouched
  if (ia > aspect) { const w = aspect / ia; tex.repeat.x = w; tex.offset.x = Math.max(0, Math.min(1 - w, fp.x - w / 2)); }
  else { const h = ia / aspect; tex.repeat.y = h; tex.offset.y = Math.max(0, Math.min(1 - h, (1 - fp.y) - h / 2)); } };

// ---------- DOM application + layout validation ----------
const $ = id => document.getElementById(id);
function fit(el, R, elId, base, fitBox, minSize) {
  let s = base; el.style.fontSize = s + 'px';
  const over = () => { const b = el.getBoundingClientRect(); return b.width > fitBox.w + 0.5 || b.height > fitBox.h + 0.5; };
  while (over() && s > minSize) { s = Math.max(minSize, s - 2); el.style.fontSize = s + 'px'; }
  if (s !== base) R.issues.push({ severity: 'info', code: 'AUTOFIT_APPLIED', element: elId, message: `font size ${base}px -> ${s}px to fit ${fitBox.w}x${fitBox.h}` });
  if (over()) { const b = el.getBoundingClientRect(); R.issues.push({ severity: 'error', code: 'TEXT_OVERFLOW', element: elId, message: `${Math.round(b.width)}x${Math.round(b.height)} exceeds fit box ${fitBox.w}x${fitBox.h} at min size ${minSize}px` }); }
  return s;
}
MS.applyDom = (R) => {
  const root = document.documentElement.style, c = R.c, e = R.e;
  root.setProperty('--deep', c.background); root.setProperty('--pine', c.primary); root.setProperty('--bone', c.text); root.setProperty('--lime', c.accent); root.setProperty('--brick', c.secondary);
  const el = id => MAN.elements.find(x => x.id === id);
  const setFont = (node, fa, tr) => { node.style.fontFamily = `"ms_${fa.asset}"`; node.style.fontWeight = String(fa.weight); if (tr) node.style.textTransform = tr; };
  // title
  const km = $('km'); km.innerHTML = e.title.text.split('\n').map(esc).join('<br>'); km.style.whiteSpace = 'nowrap';
  setFont(km, e.title.font); km.style.color = e.title.color;
  e.title.fontSizeUsed = fit(km, R, 'title', e.title.fontSize, el('title').layout.fitBox, el('title').properties.fontSize.autoFitMin);
  // pronunciation
  const pron = $('pron'); pron.innerHTML = esc(e.pronunciation.text) + ' &nbsp;<span class="it">' + esc(e.pronunciation.partOfSpeech) + '</span>';
  setFont(pron, e.pronunciation.font); pron.style.color = MS.rgba(e.pronunciation.color, .72); pron.style.whiteSpace = 'nowrap';
  fit(pron, R, 'pronunciation', 46, el('pronunciation').layout.fitBox, 34);
  // location
  const loc = $('loc'); loc.textContent = e.location.text; setFont(loc, e.location.font); loc.style.color = e.location.color; loc.style.whiteSpace = 'nowrap';
  fit(loc, R, 'location', 46, el('location').layout.fitBox, 34);
  // year
  const yr = $('yr'); yr.textContent = e.year.text; setFont(yr, e.year.font); yr.style.color = e.year.color; yr.style.whiteSpace = 'nowrap';
  fit(yr, R, 'year', 150, el('year').layout.fitBox, 110);
  // logo
  const lg = $('logo'); const L = e.logo;
  if (L.visible && L.src) { const pos = el('logo').layout.positions[L.position]; const nat = L.__nat || { w: 1, h: 1 };
    let h = L.height, w = h * nat.w / nat.h; if (w > pos.maxW) { w = pos.maxW; h = w * nat.h / nat.w; }
    Object.assign(lg.style, { display: 'block', width: w + 'px', height: h + 'px', left: (pos.anchor === 'right' ? pos.x - w : pos.x) + 'px', top: (pos.vAnchor === 'bottom' ? pos.y - h : pos.y) + 'px' });
    if (L.tint === 'original') { lg.style.backgroundImage = `url("${L.src}")`; lg.style.webkitMaskImage = lg.style.maskImage = 'none'; lg.style.backgroundColor = 'transparent'; }
    else { const col = L.tint === 'accent' ? c.accent : c.text; lg.style.backgroundImage = 'none'; lg.style.webkitMaskImage = lg.style.maskImage = `url("${L.src}")`; lg.style.backgroundColor = col; }
    if (nat.w < w || nat.h < h) R.issues.push({ severity: 'warning', code: 'IMAGE_UPSCALED', element: 'logo', message: `logo source ${nat.w}x${nat.h} shown at ${Math.round(w)}x${Math.round(h)}` });
  } else { lg.style.display = 'none'; }
  // contrast (WCAG 2.x ratio) against the darkest/lightest page tone behind the text
  const bgs = [c.background, c.pageInner, c.pageOuter];
  const cc = (elId, fg, min0) => { const sp = el(elId).contrast || {}; const min = Math.min(sp.min ?? min0, sp.designBaseline ?? 99); const worst = Math.min(...bgs.map(b => MS.contrast(fg, b))); if (worst < min) R.issues.push({ severity: worst < 2 ? 'error' : 'warning', code: 'CONTRAST_LOW', element: elId, message: `contrast ${worst.toFixed(2)}:1 < ${min}:1` }); };
  cc('title', e.title.color, 3); cc('location', e.location.color, 3); cc('year', e.year.color, 3);
  cc('pronunciation', blend(e.pronunciation.color, .72, c.pageInner), 3);
  const hsp = el('headword').contrast || {}; const hmin = Math.min(hsp.min ?? 4.5, hsp.designBaseline ?? 99); const hc = MS.contrast(e.headword.color, blend(e.headword.highlight, .92, c.pageInner)); if (hc < hmin) R.issues.push({ severity: 'warning', code: 'CONTRAST_LOW', element: 'headword', message: `contrast ${hc.toFixed(2)}:1 < ${hmin}:1` });
  // overlap check between editable elements (hold-frame layout)
  const boxes = ['km', 'pron', 'loc', 'yr', 'logo'].map(id => [id, $(id)]).filter(([, n]) => n.style.display !== 'none').map(([id, n]) => [id, n.getBoundingClientRect()]);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const [a, A] = boxes[i], [b, B] = boxes[j];
    if (A.left < B.right && B.left < A.right && A.top < B.bottom && B.top < A.bottom && !(MAN.allowedOverlaps || []).some(p => p.includes(a) && p.includes(b))) R.issues.push({ severity: 'warning', code: 'OVERLAP', message: `${a} overlaps ${b}` }); }
};
async function logoNatural(R) { const L = R.e.logo; if (!L.src) return; L.__nat = await new Promise(res => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => res({ w: 1, h: 1 }); i.src = L.src; }); }
function publicProps(R) { const o = clone({ colors: R.c, fonts: R.f, elements: R.e }); for (const v of Object.values(o.elements)) { delete v.__nat; } return o; }

// ---------- lifecycle ----------
MS.boot = async () => {
  MAN = await (await fetch('editable-elements.json')).json();
  const h = H(); THEME = h.theme; OVR = clone(h.overrides || {}); if (!THEME) throw new Error('host did not provide theme');
  const origChars = S.chars; S.chars = (...a) => { const sp = origChars(...a); splits.push(sp); return sp; };
  P = resolve(); await loadFonts(P); await logoNatural(P);
  return P;
};
MS.attach = (api) => {
  attached = api;
  const sc = window.__scene, seek0 = sc.seek;
  sc.seek = async t => { lastT = t; return seek0(t); };
  sc.contract = 'transovo.editable-elements/0.1';
  sc.sceneId = MAN.sceneId;
  sc.getProps = () => publicProps(P);
  sc.validate = () => clone(P.issues);
  sc.describe = () => { const out = {}; for (const el of MAN.elements) { const n = document.querySelector(`[data-el="${el.id}"]`); if (n) { const b = n.getBoundingClientRect(); out[el.id] = { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), visible: n.style.display !== 'none' }; } } return out; };
  sc.setProps = async (patch = {}) => {
    const t0 = performance.now();
    const prev = OVR; OVR = merge(OVR, patch);
    const R = resolve();
    const refused = R.issues.filter(i => i.code === 'TIER_NOT_LIVE');
    if (refused.length) { OVR = prev; return { ok: false, refused: true, issues: clone(refused), applyMs: Math.round(performance.now() - t0) }; }   // atomic: nothing applied
    await loadFonts(R); await logoNatural(R);
    // rebuild: revert SplitText, clear the paused timeline, reset GSAP inline state, then re-run the SAME tween code
    while (splits.length) splits.pop().revert();
    S.tl.clear(); gsap.set(['#km', '#pron', '#loc', '#yr', '#logo'], { clearProps: 'opacity,transform' });
    S.hooks.length = 0; S.hooks.push(...attached.hooks);
    P = R; await attached.apply(R);
    S._p = 0; await sc.seek(lastT);
    return { ok: !R.issues.some(i => i.severity === 'error'), issues: clone(R.issues), applyMs: Math.round(performance.now() - t0) };
  };
  window.__msReady = true;
};
export { MS };

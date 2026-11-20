// ms-props-core.js: browser runtime for editable scenes (contract transovo.editable-elements/1).
// The SAME file runs in the Transovo editor's sandboxed iframe (live preview) and in the export worker's headless Chrome.
// A scene imports it, builds itself from resolved props, then attaches an adapter. Animation code stays in the scene, untouched.
import { resolve, merge, canon, fnv } from './ms-resolve.js';
import { startBridge } from './ms-bridge.js';
export * from './ms-resolve.js';
const clone = o => JSON.parse(JSON.stringify(o ?? null));
const LAYOUT_CODES = new Set(['TEXT_OVERFLOW', 'OVERLAP', 'CONTRAST_LOW', 'OUT_OF_SAFE_AREA']);
export class MSRuntime {
  static async boot() { const rt = new MSRuntime(); await rt._boot(); return rt; }
  async _boot() {
    this.manifest = await (await fetch('editable-elements.json')).json();
    this.host = window.__MS_HOST || await startBridge.waitInit();      // worker injects __MS_HOST; the editor sends {method:'init'} over postMessage
    this.overrides = clone(this.host.overrides || {}); this.mode = this.host.mode || 'live';
    this.fontFaces = new Map(); this.lastT = 0; this.history = [];
    this.P = this._resolve(this.overrides); await this._loadFonts(this.P);
    return this.P;
  }
  _ctx() { return { mode: this.mode, fonts: this.host.fonts || {}, assets: this.host.assets || {} }; }
  _resolve(ovr) { return resolve(this.manifest, this.host.theme, ovr, this._ctx()); }
  url(assetId) { const u = (this.host.assetUrls || {})[assetId]; if (!u) throw new Error('asset not resolvable by host: ' + assetId); return u; }
  // engine-native fonts for the browser engine: every face file of the selection is registered under one alias family,
  // with its real weight/style descriptors, so CSS weight/italic pick the exact file (no synthesis when the face exists)
  family(sel) { return `"${this._alias(sel)}"`; }
  _alias(sel) { return 'ms_' + fnv(sel.faces.join('+')); }
  async _loadFonts(P) {
    const sels = []; const walk = o => { if (o && typeof o === 'object') { if (Array.isArray(o.faces)) sels.push(o); else Object.values(o).forEach(walk); } };
    walk(P.fonts); walk(P.elements); const jobs = [];
    for (const sel of sels) { const a = this._alias(sel); if (this.fontFaces.has(a)) continue; this.fontFaces.set(a, true);
      for (const id of sel.faces) { const rec = (this.host.fonts || {})[id]; if (!rec) continue; const wAx = (rec.axes || []).find(x => x.tag === 'wght');
        const ff = new FontFace(a, `url(${this.url(id.split('.')[0])})`, { weight: wAx ? `${wAx.min} ${wAx.max}` : String(rec.weightClass || 400), style: rec.italic ? 'italic' : 'normal' });
        document.fonts.add(ff); jobs.push(ff.load()); } }
    await Promise.all(jobs);
  }
  attach(adapter) {
    this.adapter = adapter; const sc = window.__scene; const seek0 = sc.seek.bind(sc);
    sc.seek = async t => { this.lastT = t; await seek0(t); };
    Object.assign(sc, {
      contract: 'transovo.editable-elements/1', sceneId: this.manifest.sceneId,
      setProps: (patch, opts) => this.setProps(patch, opts),
      getProps: () => this.getProps(),
      validate: (patch) => this.validate(patch),
      describe: (t) => this.describe(t),
      provide: (x) => this.provide(x),
    });
    this.layoutIssues = adapter.layout ? adapter.layout(this.P) || [] : [];
    window.__msReady = true; startBridge.serve(this);
  }
  // host supplies records/URLs for fonts or assets picked during editing (data only; URLs must be on the scene origin's CSP allow-list)
  provide({ fonts = {}, assetUrls = {}, assets = {} } = {}) { const H = this.host; H.fonts = { ...(H.fonts || {}), ...fonts }; H.assetUrls = { ...(H.assetUrls || {}), ...assetUrls }; H.assets = { ...(H.assets || {}), ...assets };
    return { fonts: Object.keys(fonts).length, assets: Object.keys(assets).length }; }
  getProps() { const o = clone(this.P); delete o.issues; return { sceneId: this.manifest.sceneId, overrides: clone(this.overrides), resolved: o, hash: this.P.hash }; }
  validate(patch) { // dry-run: never changes the scene
    if (!patch) return [...this.P.issues, ...this.layoutIssues];
    return this._resolve(merge(this.overrides, patch)).issues;
  }
  async describe(t) {
    const at = t ?? this.manifest.format.holdFrame / this.manifest.format.fps; const back = this.lastT;
    if (t !== undefined || this.adapter.boundsNeedSeek) await window.__scene.seek(at);
    const b = this.adapter.bounds ? await this.adapter.bounds(at) : {};
    if (t !== undefined || this.adapter.boundsNeedSeek) await window.__scene.seek(back);
    return { contract: 'transovo.editable-elements/1', sceneId: this.manifest.sceneId, t: at, format: this.manifest.format, livePreview: this.manifest.livePreview,
      elements: this.manifest.elements.map(el => ({ id: el.id, label: el.label, kind: el.kind, layer: el.layer, timing: el.timing, bounds: b[el.id] || null,
        properties: Object.fromEntries(Object.entries(el.properties).map(([k, v]) => [k, { tier: v.tier, type: v.type, value: this.P.elements[el.id][k], source: (this.P.elements[el.id].__src || {})[k] }])) })),
      issues: [...this.P.issues, ...this.layoutIssues] };
  }
  // opts.force: show an invalid state in the preview (never exportable); default = atomic reject + keep the previous state
  async setProps(patch = {}, opts = {}) {
    const t0 = performance.now(); const prevO = this.overrides, prevP = this.P;
    const candO = merge(this.overrides, patch); const R = this._resolve(candO);
    const errs = R.issues.filter(i => i.severity === 'error');
    if (errs.length && !opts.force) return { ok: false, rejected: true, stage: 'static', issues: R.issues, applyMs: Math.round(performance.now() - t0) };
    await this._loadFonts(R);
    this.overrides = candO; this.P = R;
    await this.adapter.apply(R, prevP);
    this.layoutIssues = this.adapter.layout ? this.adapter.layout(R) || [] : [];
    const lerr = this.layoutIssues.filter(i => i.severity === 'error');
    if (lerr.length && !opts.force) {   // roll back: the previous working state is restored exactly
      this.overrides = prevO; this.P = prevP; await this.adapter.apply(prevP, R); this.layoutIssues = this.adapter.layout ? this.adapter.layout(prevP) || [] : [];
      await window.__scene.seek(this.lastT);
      return { ok: false, rejected: true, stage: 'layout', issues: [...R.issues, ...lerr], applyMs: Math.round(performance.now() - t0) };
    }
    await window.__scene.seek(this.lastT);
    return { ok: !errs.length && !lerr.length, issues: [...R.issues, ...this.layoutIssues], hash: R.hash, applyMs: Math.round(performance.now() - t0) };
  }
}
// ---------- generic DOM helpers for adapters ----------
export function fitText(el, base, box, minSize, issues, id) {
  let s = base; el.style.fontSize = s + 'px';
  const over = () => { const b = el.getBoundingClientRect(); return b.width > box.w + 0.5 || b.height > box.h + 0.5; };
  while (over() && s > minSize) { s = Math.max(minSize, s - 2); el.style.fontSize = s + 'px'; }
  if (s !== base) issues.push({ severity: 'info', code: 'AUTOFIT_APPLIED', element: id, message: `font size ${base}px -> ${s}px to fit ${box.w}x${box.h}` });
  if (over()) { const b = el.getBoundingClientRect(); issues.push({ severity: 'error', code: 'TEXT_OVERFLOW', element: id, message: `${Math.round(b.width)}x${Math.round(b.height)} exceeds ${box.w}x${box.h} at min ${minSize}px` }); }
  return s;
}
export function overlaps(boxes, allowed = [], issues = []) {
  const ids = Object.keys(boxes);
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const A = boxes[ids[i]], B = boxes[ids[j]]; if (!A || !B) continue;
    if (A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h && !allowed.some(p => p.includes(ids[i]) && p.includes(ids[j]))) issues.push({ severity: 'warning', code: 'OVERLAP', message: `${ids[i]} overlaps ${ids[j]}`, elements: [ids[i], ids[j]] }); }
  return issues;
}
export function safeArea(boxes, area, issues = []) { for (const [id, b] of Object.entries(boxes)) if (b && (b.x < area.x - 0.5 || b.y < area.y - 0.5 || b.x + b.w > area.x + area.w + 0.5 || b.y + b.h > area.y + area.h + 0.5)) issues.push({ severity: 'warning', code: 'OUT_OF_SAFE_AREA', element: id, message: `${id} leaves the action-safe area` }); return issues; }
export const rectOf = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), space: 'screen' }; };
// projected screen-space bounds of a three.js object (8 bbox corners -> 2D AABB)
export function projectBounds(THREE, obj, camera, W, H) {
  const box = new THREE.Box3().setFromObject(obj); if (box.isEmpty()) return null; const v = new THREE.Vector3(); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, behind = 0;
  for (let i = 0; i < 8; i++) { v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera); if (v.z > 1) behind++;
    const sx = (v.x + 1) / 2 * W, sy = (1 - v.y) / 2 * H; x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy); }
  if (behind === 8) return null; const cx0 = Math.max(0, x0), cy0 = Math.max(0, y0), cx1 = Math.min(W, x1), cy1 = Math.min(H, y1);
  if (cx1 <= cx0 || cy1 <= cy0) return { x: 0, y: 0, w: 0, h: 0, space: 'projected', offscreen: true };
  return { x: Math.round(cx0), y: Math.round(cy0), w: Math.round(cx1 - cx0), h: Math.round(cy1 - cy0), space: 'projected', clipped: x0 < 0 || y0 < 0 || x1 > W || y1 > H };
}

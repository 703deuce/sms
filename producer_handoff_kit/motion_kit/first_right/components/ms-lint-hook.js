// ms-lint-hook.js — how a scene tells scene_lint.mjs what is on screen (window.__msLint, protocol version 1).
// Pieces from ms-pieces.js register themselves. Custom three.js / PixiJS / canvas scenes add a few lines (see README).
//
// window.__msLint = {
//   version: 1,
//   changePoints(): number[]            seconds where something starts/stops/changes (keyframes, cuts, layer windows)
//   layers(t): Layer[]                  what is on screen after seek(t)  (may be async)
//   hide?(id, hidden): void             optional: hide one layer for background sampling (canvas-drawn text needs it)
// }
// Layer = { id, kind: 'text'|'media'|'shape'|'graphic', role?: 'background'|'plate'|..., allowOverlap?: [{with, reason}]|string[],
//   faces?: number, plateFor?: id,
//   el?: Element            DOM layer: the lint measures box, ink, font, colour, opacity itself
//   textEl?: Element        DOM text node holder (defaults to el)
//   box?: {x,y,w,h}         canvas/WebGL layer: screen box in output px (use projectBox for three.js objects)
//   opacity?: number        canvas layer opacity (default 1)
//   text?: { value, color:'#rrggbb', fontPx (on screen, after scale), family, weight, ink?:{x,y,w,h}, fitBox?:{x,y,w,h} } }
(function (G) {
  const reg = new Map(); let cps = () => [];
  const MSLint = {
    /** Register a DOM layer (stays registered; the lint reads its live state each seek). */
    dom(el, meta) { reg.set(meta.id, { ...meta, el: typeof el === 'string' ? () => document.querySelector(el) : el }); return el; },
    /** Register a canvas/WebGL-drawn layer; get(t) returns the Layer fields that change (box, opacity, text). */
    canvas(meta, get) { reg.set(meta.id, { ...meta, get }); },
    remove(id) { reg.delete(id); },
    changePoints(fn) { cps = typeof fn === 'function' ? fn : () => fn; },
    install(extra = {}) {
      G.__msLint = { version: 1, changePoints: () => cps(),
        async layers(t) { const out = [];
          for (const [id, m] of reg) { const el = typeof m.el === 'function' ? m.el() : m.el; const live = m.get ? await m.get(t) : {};
            if (m.get && live == null) continue;
            out.push({ ...m, ...live, id, el: el || undefined, get: undefined }); }
          if (extra.layers) out.push(...(await extra.layers(t)));
          return out; },
        hide: extra.hide || ((id, h) => { const m = reg.get(id); const el = m && (typeof m.el === 'function' ? m.el() : m.el); if (el) el.style.visibility = h ? 'hidden' : ''; }) };
      return G.__msLint;
    },
  };
  /** three.js: screen box (output px) of an Object3D's world bounding box. */
  MSLint.projectBox = function (THREE, obj, camera, W, H) {
    const b = new THREE.Box3().setFromObject(obj); if (b.isEmpty()) return null; const v = new THREE.Vector3(); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, behind = 0;
    for (let i = 0; i < 8; i++) { v.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(camera); if (v.z > 1) behind++;
      const sx = (v.x + 1) / 2 * W, sy = (1 - v.y) / 2 * H; x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy); }
    if (behind === 8) return null; return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };
  /** PixiJS: screen box of a DisplayObject (getBounds is already in renderer px; pass resolution if not 1). */
  MSLint.pixiBox = function (obj, res = 1) { const r = obj.getBounds(); return { x: r.x / res, y: r.y / res, w: r.width / res, h: r.height / res }; };
  G.MSLint = MSLint;
})(typeof globalThis !== 'undefined' ? globalThis : window);

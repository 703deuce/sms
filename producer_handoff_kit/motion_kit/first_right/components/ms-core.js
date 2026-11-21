// ms-core.js — shared layout rules for Motion Studio "right the first time" (SKILL.md Stage 4c).
// Plain script (no imports/exports) so it runs as a classic <script>, as an ES-module side-effect import,
// inside the lint's headless page, and in Node (pure functions only there). Exposes globalThis.MSCore.
// Engine-agnostic: no look, no fonts, no colours. Style always comes from the film's design system.
(function (G) {
  'use strict';
  const BASE = 1080;                 // "1080p": the short side of the frame
  const CAP_MIN_1080 = 40;           // skill: label cap height >= 40 px at 1080p
  const CAPTION_LH_916 = 75 / 1920;  // craft-standards 1.10: 9:16 caption line height >= 75 px at 1080x1920

  /** Readable floor in px for this output size: 40 px cap height at 1080p, scaled by the short side. */
  function capFloor(W, H) { return CAP_MIN_1080 * Math.min(W, H) / BASE; }
  function aspectOf(W, H) { const r = W / H; if (Math.abs(r - 9 / 16) < 0.02) return '9:16'; if (Math.abs(r - 16 / 9) < 0.02) return '16:9';
    if (Math.abs(r - 1) < 0.02) return '1:1'; if (Math.abs(r - 4 / 5) < 0.02) return '4:5'; return 'other'; }

  /**
   * Safe area for critical text (craft-standards 1.9 / SKILL.md Stage 5 step 5):
   *  9:16  universal safe box x 120–888, y 288–1248 at 1080x1920, right edge moves in to x 780 below y 780.
   *  16:9 and every other aspect: SMPTE title-safe 90% (5% inset on every side).
   * Returns { kind, rect, cutout } in output px. cutout = { yFrom, xMax } (9:16 only).
   */
  function safeArea(W, H) {
    const a = aspectOf(W, H);
    if (a === '9:16') { const s = W / 1080;
      return { kind: 'universal-9x16', rect: { x: 120 * s, y: 288 * s, w: 768 * s, h: 960 * s }, cutout: { yFrom: 780 * s, xMax: 780 * s } }; }
    return { kind: 'title-safe-90', rect: { x: 0.05 * W, y: 0.05 * H, w: 0.9 * W, h: 0.9 * H }, cutout: null };
  }
  /** How far (px) a box sticks out of the safe area (0 = inside). tol absorbs sub-pixel rounding. */
  function safeExcess(box, sa, tol = 1) {
    const r = sa.rect; let right = r.x + r.w;
    if (sa.cutout && box.y + box.h > sa.cutout.yFrom + tol) right = Math.min(right, sa.cutout.xMax);
    const e = { left: r.x - box.x, top: r.y - box.y, right: box.x + box.w - right, bottom: box.y + box.h - (r.y + r.h) };
    for (const k in e) e[k] = e[k] > tol ? Math.round(e[k] * 10) / 10 : 0;
    return e;
  }
  const isOut = e => e.left > 0 || e.top > 0 || e.right > 0 || e.bottom > 0;
  /** Clamp a slot into the safe area (used by the planner and pieces; never shrinks below w/h given if it can move). */
  function clampToSafe(box, sa) {
    const r = sa.rect; const b = { ...box };
    b.w = Math.min(b.w, r.w); b.h = Math.min(b.h, r.h);
    b.x = Math.max(r.x, Math.min(b.x, r.x + r.w - b.w)); b.y = Math.max(r.y, Math.min(b.y, r.y + r.h - b.h));
    if (sa.cutout && b.y + b.h > sa.cutout.yFrom && b.x + b.w > sa.cutout.xMax) { b.x = Math.max(r.x, sa.cutout.xMax - b.w); if (b.x + b.w > sa.cutout.xMax) b.w = sa.cutout.xMax - b.x; }
    return b;
  }

  // ---------- geometry ----------
  const area = b => Math.max(0, b.w) * Math.max(0, b.h);
  function inter(a, b) { const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y), r = Math.min(a.x + a.w, b.x + b.w), btm = Math.min(a.y + a.h, b.y + b.h);
    return r > x && btm > y ? { x, y, w: r - x, h: btm - y } : null; }
  function contains(outer, inner, tol = 0.75) { return inner.x >= outer.x - tol && inner.y >= outer.y - tol && inner.x + inner.w <= outer.x + outer.w + tol && inner.y + inner.h <= outer.y + outer.h + tol; }
  function union(list) { if (!list.length) return null; let x = Infinity, y = Infinity, r = -Infinity, b = -Infinity;
    for (const q of list) { x = Math.min(x, q.x); y = Math.min(y, q.y); r = Math.max(r, q.x + q.w); b = Math.max(b, q.y + q.h); } return { x, y, w: r - x, h: b - y }; }
  function iou(a, b) { const i = inter(a, b); if (!i) return 0; return area(i) / (area(a) + area(b) - area(i)); }

  // ---------- colour ----------
  function hexToRgb(h) { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '').trim()); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function cssToRgb(c) { if (!c) return null; const h = hexToRgb(c); if (h) return h; const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return p.slice(0, 3); }
  function relLum([r, g, b]) { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
  function contrast(a, b) { const A = relLum(a), B = relLum(b); return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); }

  // ---------- text fitting (needs a 2D canvas context; browser) ----------
  let _ctx = null;
  function ctx2d() { if (_ctx) return _ctx; const c = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(8, 8) : document.createElement('canvas'); _ctx = c.getContext('2d'); return _ctx; }
  function fontCss(f, size) { return `${f.style || 'normal'} ${f.weight || 400} ${size}px ${f.family}`; }
  /** Cap height / font size for a font (measured from 'H'). */
  function capRatio(f) { const c = ctx2d(); c.font = fontCss(f, 200); c.letterSpacing = '0px'; const m = c.measureText('H'); return (m.actualBoundingBoxAscent || 140) / 200; }
  function applyTransform(s, t) { return t === 'uppercase' ? s.toUpperCase() : t === 'lowercase' ? s.toLowerCase() : s; }
  function measure(text, f, size) { const c = ctx2d(); c.font = fontCss(f, size); c.letterSpacing = ((f.letterSpacing || 0) * size) + 'px'; return c.measureText(text).width; }
  /** Greedy wrap honouring explicit \n. Returns lines or null if a single word is wider than w. */
  function wrap(text, f, size, w) {
    const out = [];
    for (const para of String(text).split('\n')) {
      const words = para.split(/ +/).filter(x => x.length); if (!words.length) { out.push(''); continue; }
      let line = '';
      for (const wd of words) { const cand = line ? line + ' ' + wd : wd;
        if (measure(cand, f, size) <= w + 0.5) line = cand;
        else { if (!line) return null; out.push(line); line = wd; if (measure(line, f, size) > w + 0.5) return null; } }
      out.push(line);
    }
    return out;
  }
  /**
   * Auto-fit text into a box. Shrinks from sizeRange[1] down to sizeRange[0] (or wraps up to maxLines), but never below the
   * readable floor (cap height >= capFloor(W,H), plus the 9:16 caption line-height floor for role 'caption').
   * opts: { text, font:{family, weight, style, letterSpacing(em), lineHeight, transform}, box:{w,h}, sizeRange:[min,max],
   *         maxLines, frame:{W,H}, role, minCapPx (override upward only) }
   * Returns { ok:true, size, lines, capPx, lineHeightPx, width, height } or { ok:false, error, message, floorSize, need }.
   */
  function fitText(o) {
    const f = { lineHeight: 1.05, letterSpacing: 0, ...o.font }; if (!f.family) throw new Error('fitText: font.family is required (from the design system)');
    const { W, H } = o.frame || {}; if (!W || !H) throw new Error('fitText: frame {W,H} is required');
    const text = applyTransform(String(o.text ?? ''), f.transform);
    const cr = capRatio(f);
    const capMin = o.role === 'credit' ? (o.minCapPx || 0) : Math.max(capFloor(W, H), o.minCapPx || 0); // credit lines exempt from the readable floor (Rick, Nov 18)
    let floor = capMin / cr;
    if (o.role === 'caption' && aspectOf(W, H) === '9:16') floor = Math.max(floor, (CAPTION_LH_916 * H) / f.lineHeight);
    floor = Math.ceil(floor * 2) / 2;
    const [lo0, hi] = o.sizeRange || []; if (!hi) throw new Error('fitText: sizeRange [min,max] is required (from the design system)');
    const lo = Math.max(lo0 || 0, floor), maxLines = o.maxLines || 1;
    const ok = s => { const lines = wrap(text, f, s, o.box.w); if (!lines || lines.length > maxLines) return null;
      const lh = s * f.lineHeight; const h = lines.length * lh; if (h > o.box.h + 0.5) return null;
      return { lines, width: Math.max(...lines.map(l => measure(l, f, s))), height: h, lineHeightPx: lh }; };
    if (hi < floor) return { ok: false, error: 'SIZE_RANGE_BELOW_READABLE', message: `design max ${hi}px is below the readable floor ${floor}px (cap ${capMin.toFixed(1)}px)`, floorSize: floor };
    let best = null, a = lo, b = hi;
    if (ok(hi)) best = { s: hi, r: ok(hi) };
    else { // largest fitting size, 0.5 px precision (fit is monotonic in size)
      if (!ok(lo)) { const atFloor = wrap(text, f, lo, o.box.w);
        return { ok: false, error: 'TEXT_DOES_NOT_FIT', floorSize: lo,
          message: `"${text.slice(0, 40)}" does not fit ${Math.round(o.box.w)}x${Math.round(o.box.h)} in ${maxLines} line(s) at the readable minimum ${lo}px; shorten the line or widen the box`,
          need: atFloor ? { lines: atFloor.length, height: Math.ceil(atFloor.length * lo * f.lineHeight) } : { width: Math.ceil(Math.max(...text.split(/\s+/).map(x => measure(x, f, lo)))) } }; }
      while (b - a > 0.5) { const m = Math.round((a + b)) / 2; if (ok(m)) a = m; else b = m; }
      best = { s: a, r: ok(a) };
    }
    return { ok: true, size: best.s, lines: best.r.lines, capPx: best.s * cr, capRatio: cr, lineHeightPx: best.r.lineHeightPx, width: best.r.width, height: best.r.height, floorSize: floor };
  }

  G.MSCore = { capFloor, aspectOf, safeArea, safeExcess, isOut, clampToSafe, area, inter, contains, union, iou,
    hexToRgb, cssToRgb, relLum, contrast, fontCss, capRatio, measure, wrap, fitText, applyTransform, CAP_MIN_1080, CAPTION_LH_916 };
  if (typeof module !== 'undefined' && module.exports) module.exports = G.MSCore;
})(typeof globalThis !== 'undefined' ? globalThis : window);

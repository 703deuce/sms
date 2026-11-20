// probe.js — injected into the scene page by scene_lint.mjs (after ms-core.js). Reads what is on screen after a seek.
// Sources, in order: window.__msLint (pieces / custom hook), the transovo.layer-scene/1 runtime (built in: [data-layer] + layers.json).
(function () {
  const C = globalThis.MSCore;
  let LS = null; const lastEls = new Map();   // id -> DOM element holding the text (for hide)   // layer-scene spec when running on the ms-layers runtime
  const ctx = (() => { const c = document.createElement('canvas'); return c.getContext('2d'); })();

  function opacityOf(el) { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none') return 0; o *= parseFloat(cs.opacity); } return o; }
  function visibleOf(el) { const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none'; }
  const R = r => ({ x: r.left ?? r.x, y: r.top ?? r.y, w: r.width ?? r.w, h: r.height ?? r.h });
  const round = b => b && ({ x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10, w: Math.round(b.w * 10) / 10, h: Math.round(b.h * 10) / 10 });
  function toHex(css) { const v = C.cssToRgb(css); return v ? '#' + v.map(x => Math.round(x).toString(16).padStart(2, '0')).join('') : null; }
  function clipAncestors(el) { const out = []; for (let e = el.parentElement; e && e !== document.documentElement; e = e.parentElement) { const cs = getComputedStyle(e);
    if (/(hidden|clip|scroll|auto)/.test(cs.overflow + cs.overflowX + cs.overflowY)) out.push({ tag: e.id ? '#' + e.id : e.tagName.toLowerCase(), box: R(e.getBoundingClientRect()) }); } return out; }

  /** DOM text: font, colour, cap height on screen, glyph ink per line (screen px), layout box. */
  function measureDomText(textEl, fitEl) {
    const cs = getComputedStyle(textEl); const fs = parseFloat(cs.fontSize);
    const r = textEl.getBoundingClientRect(); const scale = textEl.offsetHeight ? r.height / textEl.offsetHeight : (textEl.offsetWidth ? r.width / textEl.offsetWidth : 1);
    const raw = (textEl.innerText || textEl.textContent || '').replace(/\r/g, ''); const value = C.applyTransform(raw, cs.textTransform);
    const font = `${cs.fontStyle} ${cs.fontWeight} ${fs}px ${cs.fontFamily}`; ctx.font = font; ctx.letterSpacing = '0px';
    const mH = ctx.measureText('H'); const mAll = ctx.measureText(value.replace(/\s+/g, ' ') || 'H');
    const capPx = (mH.actualBoundingBoxAscent || fs * 0.7) * scale, fontAsc = mAll.fontBoundingBoxAscent;
    const inkAsc = Math.max(mAll.actualBoundingBoxAscent, mH.actualBoundingBoxAscent), inkDesc = Math.max(0, mAll.actualBoundingBoxDescent);
    const rg = document.createRange(); rg.selectNodeContents(textEl);
    const frags = [...rg.getClientRects()].filter(q => q.width > 0.5 && q.height > 0.5);
    const lines = [];
    for (const q of frags) { const L = lines.find(l => Math.abs(l.top - q.top) < 2); if (L) { L.left = Math.min(L.left, q.left); L.right = Math.max(L.right, q.right); } else lines.push({ top: q.top, left: q.left, right: q.right }); }
    const ink = lines.map(l => { const base = l.top + fontAsc * scale; return { x: l.left, y: base - inkAsc * scale, w: l.right - l.left, h: (inkAsc + inkDesc) * scale }; });
    const fit = fitEl ? R(fitEl.getBoundingClientRect()) : R(r);
    return { value, color: toHex(cs.color), fontPx: fs * scale, capPx, family: cs.fontFamily, weight: cs.fontWeight, layout: R(r), fitBox: fit, ink, inkBox: C.union(ink), clips: clipAncestors(textEl), scale };
  }

  async function layerSceneLayers() {
    if (!LS) LS = await (await fetch('layers.json')).json();
    const W = LS.width, H = LS.height, out = [];
    for (const l of LS.layers) {
      if (l.kind === 'group') continue;
      const el = document.querySelector(`[data-layer="${l.id}"]`); if (!el) { out.push({ id: l.id, kind: l.kind, missing: true }); continue; }
      const b = l.box || { x: 0, y: 0, w: W, h: H }; const full = b.w * b.h >= 0.9 * W * H;
      const m = l.lint || {};
      out.push({ id: l.id, kind: l.kind === 'text' ? 'text' : l.kind === 'shape' ? 'shape' : 'media', role: m.role || ((l.kind === 'video' || l.kind === 'image') && full ? 'background' : undefined),
        el, textEl: l.kind === 'text' ? el.firstElementChild : undefined, allowOverlap: m.allowOverlap || l.allowOverlap, faces: m.faces, plateFor: m.plateFor });
    }
    return out;
  }
  function layerSceneChangePoints() { const s = new Set([0]); for (const l of LS.layers) { if (l.startMs != null) s.add(l.startMs / 1000); if (l.endMs != null) s.add(l.endMs / 1000);
    for (const ks of Object.values(l.keyframes || {})) for (const k of ks) s.add(k.t / 1000); } return [...s].sort((a, b) => a - b); }

  async function source() {
    if (window.__msLint && window.__msLint.layers) return 'hook';
    if (document.querySelector('[data-layer]')) { try { if (!LS) LS = await (await fetch('layers.json')).json(); return 'layer-scene'; } catch { /* not a layer scene */ } }
    return null;
  }

  async function collect(t) {
    const src = await source(); if (!src) return { error: 'NO_LINT_HOOK' };
    const raw = src === 'hook' ? await window.__msLint.layers(t) : await layerSceneLayers();
    const out = [];
    for (const L of raw) {
      if (L.missing) { out.push({ id: L.id, kind: L.kind, missing: true }); continue; }
      const o = { id: L.id, kind: L.kind || 'graphic', role: L.role, allowOverlap: L.allowOverlap, faces: L.faces, plateFor: L.plateFor };
      const el = L.el && (typeof L.el === 'string' ? document.querySelector(L.el) : L.el);
      if (el) { lastEls.set(L.id, (L.textEl && (typeof L.textEl === 'string' ? document.querySelector(L.textEl) : L.textEl)) || el);
        o.opacity = visibleOf(L.textEl || el) && visibleOf(el) ? opacityOf(L.textEl || el) : 0;
        o.box = R(el.getBoundingClientRect());
        if (o.kind === 'text') o.text = measureDomText(L.textEl || el, el);
        if (o.kind === 'media') { const m = el.tagName === 'IMG' || el.tagName === 'VIDEO' || el.tagName === 'CANVAS' ? el : el.querySelector('img,video,canvas');
          if (m) o.mediaLoaded = m.tagName === 'IMG' ? (m.complete && m.naturalWidth > 0) : m.tagName === 'VIDEO' ? m.readyState >= 2 : true; }
        if (o.kind === 'shape') { const sh = el.querySelector('svg rect,svg ellipse,svg path'); if (sh) o.box = R(sh.getBoundingClientRect()); }
      } else {
        o.opacity = L.opacity ?? 1; o.box = L.box || null; if (L.poly) { o.poly = L.poly; if (!o.box) { const xs = L.poly.map(p => p[0]), ys = L.poly.map(p => p[1]); o.box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; } }
        if (L.text) { const T = L.text; const fam = T.family || 'sans-serif'; ctx.font = `${T.weight || 400} ${T.fontPx}px ${fam}`; const cap = T.capPx ?? ctx.measureText('H').actualBoundingBoxAscent;
          o.text = { value: T.value, color: T.color, fontPx: T.fontPx, capPx: cap, family: fam, layout: T.ink || L.box, fitBox: T.fitBox || L.box, ink: [T.ink || L.box], inkBox: T.ink || L.box, clips: [], canvas: true }; }
      }
      if (o.box) o.box = round(o.box);
      out.push(o);
    }
    return { src, layers: out };
  }

  async function changePoints() {
    const src = await source();
    if (src === 'hook') return window.__msLint.changePoints ? await window.__msLint.changePoints() : [];
    if (src === 'layer-scene') return layerSceneChangePoints();
    return [];
  }
  async function hide(id, h) {
    const el = lastEls.get(id); if (el && el.isConnected) { el.style.visibility = h ? 'hidden' : ''; return true; }   // DOM text: hide just the glyphs, keep its plate
    if (window.__msLint && window.__msLint.hide) { await window.__msLint.hide(id, h); return true; }
    return false;
  }
  async function decode(b64) { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height); }
  /** WCAG contrast of the text colour against every background pixel in the region; returns low percentiles. */
  async function contrastOf(b64, hex, excludeNear) {
    const d = await decode(b64), fg = C.hexToRgb(hex); const v = []; const px = d.data;
    for (let i = 0; i < px.length; i += 4) { const p = [px[i], px[i + 1], px[i + 2]]; if (excludeNear && Math.abs(p[0] - fg[0]) + Math.abs(p[1] - fg[1]) + Math.abs(p[2] - fg[2]) < 90) continue; v.push(C.contrast(fg, p)); }
    v.sort((a, b) => a - b); const q = f => v.length ? Math.round(v[Math.min(v.length - 1, Math.floor(f * v.length))] * 100) / 100 : null;
    return { p05: q(0.05), p10: q(0.10), median: q(0.5), n: v.length };
  }
  async function pixelStats(b64) { const d = await decode(b64), px = d.data; let s = 0, s2 = 0, n = 0;
    for (let i = 0; i < px.length; i += 4) { const y = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]; s += y; s2 += y * y; n++; }
    const m = s / n; return { mean: Math.round(m * 10) / 10, std: Math.round(Math.sqrt(Math.max(0, s2 / n - m * m)) * 10) / 10 }; }
  window.__msProbe = { collect, changePoints, hide, contrastOf, pixelStats, source };
})();

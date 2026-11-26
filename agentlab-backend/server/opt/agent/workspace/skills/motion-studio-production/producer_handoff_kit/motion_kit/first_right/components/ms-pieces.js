// ms-pieces.js — tested layout pieces (Stage 4c step 1): title, number callout, lower-third, label, caption block,
// footage/photo box. Plain DOM + canvas helpers, usable inside any browser engine page (three.js, PixiJS, GSAP, D3,
// Remotion/HyperFrames DOM, the layer-scene runtime). Every text piece:
//   - sits in a slot box (from design/layout.json), checked against the frame safe area,
//   - auto-fits: shrinks within the design system's sizeRange or wraps to the planned line count,
//   - never goes below the readable floor (cap height 40 px at 1080p, scaled); if it cannot fit it throws
//     MSFitError (or returns {ok:false} with onError:'return') instead of shrinking past readable,
//   - registers itself with the lint hook (window.__msLint) so scene_lint.mjs can measure it.
// No fixed look: font, colour, size range, plate and spacing are required inputs from design/system.md.
import './ms-core.js';
import './ms-lint-hook.js';
const C = globalThis.MSCore, L = globalThis.MSLint;

export class MSFitError extends Error { constructor(id, r) { super(`${id}: ${r.error}: ${r.message}`); this.id = id; this.result = r; } }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function need(o, keys, what) { for (const k of keys) if (o == null || o[k] == null) throw new Error(`${what}: "${k}" is required (it comes from the film's design system)`); }
function frameOf(o) { const f = o.frame || globalThis.__msFrame; if (!f || !f.W || !f.H) throw new Error('pieces: pass frame {W,H} or set globalThis.__msFrame'); return f; }

function checkSafe(id, box, frame, opts) {
  if (opts.safe === false) return null;   // only for non-critical decoration; text pieces never pass safe:false
  const sa = C.safeArea(frame.W, frame.H), e = C.safeExcess(box, sa);
  if (!C.isOut(e)) return null;
  if (opts.clampToSafe) return C.clampToSafe(box, sa);
  throw new Error(`${id}: slot ${JSON.stringify(box)} leaves the ${sa.kind} safe area by ${JSON.stringify(e)}; take the slot from layout.json`);
}

/** Core text block: plate (optional) + fitted text inside box. */
function textBlock(host, o, role, defaults = {}) {
  need(o, ['id', 'box', 'text', 'style'], role); need(o.style, ['font', 'color', 'sizeRange'], role + '.style'); need(o.style.font, ['family'], role + '.style.font');
  const frame = frameOf(o); const st = { maxLines: defaults.maxLines || 1, align: defaults.align || 'left', ...o.style };
  let box = { ...o.box }; const moved = checkSafe(o.id, box, frame, o); if (moved) box = moved;
  const p = st.plate || null; const padX = p ? (p.padX ?? 0) : 0, padY = p ? (p.padY ?? 0) : 0;
  const inner = { w: box.w - 2 * padX, h: box.h - 2 * padY };
  const fit = C.fitText({ text: o.text, font: st.font, box: inner, sizeRange: st.sizeRange, maxLines: o.lines || st.maxLines, frame, role, minCapPx: st.minCapPx });
  if (!fit.ok) { if (o.onError === 'return') return { ok: false, id: o.id, error: fit }; throw new MSFitError(o.id, fit); }
  const el = document.createElement('div'); el.dataset.msPiece = role; el.dataset.msId = o.id;
  const plateW = p && p.hug ? Math.min(box.w, fit.width + 2 * padX) : box.w;
  const plateX = p && p.hug ? (st.align === 'right' ? box.x + box.w - plateW : st.align === 'center' ? box.x + (box.w - plateW) / 2 : box.x) : box.x;
  el.style.cssText = `position:absolute;left:${plateX}px;top:${box.y}px;width:${plateW}px;height:${p && p.hug ? fit.height + 2 * padY : box.h}px;box-sizing:border-box;` +
    `padding:${padY}px ${padX}px;${p ? `background:${p.color};border-radius:${p.radius || 0}px;` : ''}`;
  const t = document.createElement('div');
  const f = st.font;
  t.style.cssText = `white-space:pre;font-family:${f.family};font-weight:${f.weight || 400};font-style:${f.style || 'normal'};font-size:${fit.size}px;` +
    `line-height:${f.lineHeight ?? 1.05};letter-spacing:${f.letterSpacing || 0}em;text-align:${st.align};color:${st.color};` +
    `${st.shadow ? `text-shadow:${st.shadow};` : ''}${f.features ? `font-feature-settings:${f.features};` : ''}display:block;width:100%`;
  t.innerHTML = fit.lines.map(esc).join('\n');   // lines are fixed by the fit: no browser re-wrap
  el.appendChild(t); (host || document.body).appendChild(el);
  L.dom(el, { id: o.id, kind: 'text', role, textEl: t, allowOverlap: o.allowOverlap });
  return { ok: true, id: o.id, el, textEl: t, fit, box: { x: plateX, y: box.y, w: plateW, h: box.h } };
}

export function title(host, o) { return textBlock(host, o, 'title', { maxLines: 2 }); }
export function label(host, o) { return textBlock(host, o, 'label', { maxLines: 1 }); }
export function caption(host, o) { const f = frameOf(o); return textBlock(host, o, 'caption', { maxLines: C.aspectOf(f.W, f.H) === '9:16' ? 3 : 2, align: 'center' }); }

/** Number callout: the number (tabular figures) on top, an optional label under it, each fitted in its own share of the slot. */
export function numberCallout(host, o) {
  need(o, ['id', 'box', 'value', 'style'], 'numberCallout'); need(o.style, ['number'], 'numberCallout.style');
  const share = o.numberShare ?? (o.label ? 0.68 : 1), gap = o.gap ?? 0;
  const nb = { x: o.box.x, y: o.box.y, w: o.box.w, h: Math.floor(o.box.h * share) };
  const n = textBlock(host, { ...o, box: nb, text: o.value, style: { ...o.style.number, font: { features: '"tnum" 1', ...o.style.number.font } } }, 'number', { maxLines: 1 });
  if (!n.ok || !o.label) return n;
  need(o.style, ['label'], 'numberCallout.style');
  const lb = { x: o.box.x, y: nb.y + nb.h + gap, w: o.box.w, h: o.box.h - nb.h - gap };
  const l = textBlock(host, { ...o, id: o.id + '_label', box: lb, text: o.label, style: o.style.label }, 'label', { maxLines: o.labelLines || 2 });
  return l.ok ? { ok: true, id: o.id, number: n, label: l } : l;
}

/** Lower-third: name line + role line on an optional shared plate. */
export function lowerThird(host, o) {
  need(o, ['id', 'box', 'name', 'style'], 'lowerThird'); need(o.style, ['name'], 'lowerThird.style');
  const share = o.role ? (o.nameShare ?? 0.6) : 1, frame = frameOf(o);
  if (o.style.plate) { const pl = document.createElement('div'); pl.dataset.msPiece = 'plate';
    pl.style.cssText = `position:absolute;left:${o.box.x}px;top:${o.box.y}px;width:${o.box.w}px;height:${o.box.h}px;background:${o.style.plate.color};border-radius:${o.style.plate.radius || 0}px`;
    (host || document.body).appendChild(pl); L.dom(pl, { id: o.id + '_plate', kind: 'shape', role: 'plate', plateFor: [o.id + '_name', o.id + '_role'] }); }
  const pad = o.style.plate ? (o.style.plate.padX ?? 0) : 0, padY = o.style.plate ? (o.style.plate.padY ?? 0) : 0;
  const inner = { x: o.box.x + pad, y: o.box.y + padY, w: o.box.w - 2 * pad, h: o.box.h - 2 * padY };
  const nb = { ...inner, h: Math.floor(inner.h * share) };
  const n = textBlock(host, { ...o, frame, id: o.id + '_name', box: nb, text: o.name, style: o.style.name }, 'lowerThird', { maxLines: 1 });
  if (!n.ok || !o.role) return n;
  const rb = { ...inner, y: nb.y + nb.h, h: inner.h - nb.h };
  const r = textBlock(host, { ...o, frame, id: o.id + '_role', box: rb, text: o.role, style: o.style.role || o.style.name }, 'lowerThird', { maxLines: 1 });
  return r.ok ? { ok: true, id: o.id, name: n, role: r } : r;
}

/**
 * Footage/photo box: shows media cropped by face_frame.py output, so faces sit centred (eyes on the upper third).
 * o: { id, box, media: HTMLImageElement|HTMLVideoElement|HTMLCanvasElement, framing?: face_frame JSON, clipStart?: s,
 *      faces?: expected face count, fit?: 'cover' }  ->  { el, update(t) }
 */
export function mediaBox(host, o) {
  need(o, ['id', 'box', 'media'], 'mediaBox');
  const el = document.createElement('div'); el.dataset.msPiece = 'media';
  el.style.cssText = `position:absolute;left:${o.box.x}px;top:${o.box.y}px;width:${o.box.w}px;height:${o.box.h}px;overflow:hidden`;
  const m = o.media; m.style.position = 'absolute'; m.style.maxWidth = 'none'; el.appendChild(m); (host || document.body).appendChild(el);
  const sw = () => o.framing?.source?.w || m.naturalWidth || m.videoWidth || m.width, sh = () => o.framing?.source?.h || m.naturalHeight || m.videoHeight || m.height;
  function cropAt(t) { const shots = o.framing?.shots || []; const ct = t - (o.clipStart || 0);
    const s = shots.find(x => ct >= x.t0 && ct < x.t1) || shots[shots.length - 1];
    if (s && s.crop) return s.crop;
    const W = sw(), H = sh(), k = Math.max(o.box.w / W, o.box.h / H); const cw = o.box.w / k, ch = o.box.h / k; return { x: (W - cw) / 2, y: (H - ch) / 2, w: cw, h: ch }; }
  function update(t = 0) { const c = cropAt(t), k = o.box.w / c.w;
    m.style.width = sw() * k + 'px'; m.style.height = sh() * k + 'px'; m.style.left = -c.x * k + 'px'; m.style.top = -c.y * k + 'px'; return c; }
  update(0);
  L.dom(el, { id: o.id, kind: 'media', role: o.role || 'footage', faces: o.faces ?? o.framing?.expectFaces, allowOverlap: o.allowOverlap });
  return { ok: true, id: o.id, el, update };
}

// ---------- canvas helpers (PixiJS/three.js textures, raw 2D canvas) ----------
/** Fit text for a canvas-drawn layer (same rules as the DOM pieces). Returns the fit or throws MSFitError. */
export function fitForCanvas(o) { const fit = C.fitText({ text: o.text, font: o.style.font, box: o.box, sizeRange: o.style.sizeRange, maxLines: o.lines || o.style.maxLines || 1, frame: frameOf(o), role: o.role });
  if (!fit.ok) throw new MSFitError(o.id, fit); return fit; }
/** Draw a fit into a 2D context at box (top-left), honouring align and lineHeight. */
export function drawFitted(ctx, fit, box, style) {
  const f = style.font; ctx.save(); ctx.font = C.fontCss(f, fit.size); ctx.letterSpacing = ((f.letterSpacing || 0) * fit.size) + 'px'; ctx.fillStyle = style.color; ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText('H'); const lh = fit.lineHeightPx; const asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent;
  fit.lines.forEach((ln, i) => { const w = ctx.measureText(ln).width; const x = style.align === 'right' ? box.x + box.w - w : style.align === 'center' ? box.x + (box.w - w) / 2 : box.x;
    ctx.fillText(ln, x, box.y + i * lh + (lh - (asc + desc)) / 2 + asc); });
  ctx.restore();
}
/** Draw media into a 2D context through a face_frame crop. */
export function drawMedia(ctx, src, box, crop) { ctx.drawImage(src, crop.x, crop.y, crop.w, crop.h, box.x, box.y, box.w, box.h); }
export const core = C, lint = L;

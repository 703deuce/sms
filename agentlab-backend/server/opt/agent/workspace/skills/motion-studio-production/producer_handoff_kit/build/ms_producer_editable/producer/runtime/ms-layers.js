// ms-layers.js: generic layered scene runtime (transovo.layer-scene/1).
// One implementation for the editor's live preview iframe and the worker's headless Chrome export.
// The scene is data (layers.json): groups, text, shapes, images and videos with stable ids, a parent
// tree, base transforms and comp-local keyframes (ms from the scene start). Edits arrive as resolved
// props (P.elements[layerId]) and never require an AI call.
import { MSRuntime, fitText, rectOf } from './ms-props-core.js';

const EASE = {
  linear: (x) => x,
  in: (x) => x * x * x,
  out: (x) => 1 - Math.pow(1 - x, 3),
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
};
const NUM = ['x', 'y', 'scale', 'rotation', 'opacity', 'draw'];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SVGNS = 'http://www.w3.org/2000/svg';

function sample(keys, ms, fallback) {
  if (!Array.isArray(keys) || !keys.length) return fallback;
  if (ms <= keys[0].t) return keys[0].v;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (ms < b.t) {
      if (a.ease === 'hold') return a.v;
      const f = (EASE[b.ease] || EASE.inOut)((ms - a.t) / Math.max(1, b.t - a.t));
      return a.v + (b.v - a.v) * f;
    }
  }
  return keys[keys.length - 1].v;
}

const spec = await (await fetch('layers.json')).json();
const rt = await MSRuntime.boot();
const W = spec.width, H = spec.height, DUR = spec.durationMs / 1000;
const stage = document.getElementById('stage');
stage.style.cssText = `position:relative;width:${W}px;height:${H}px;overflow:hidden`;
const nodes = new Map();
let issues = [];
let P = rt.P;

function color(v, fb) { return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : fb; }

function build() {
  stage.innerHTML = '';
  nodes.clear();
  issues = [];
  const bg = P.elements.sceneSettings?.background ?? spec.background;
  stage.style.background = color(bg, color(P.colors?.background, '#000000'));
  const kids = new Map();
  for (const l of spec.layers) { const p = l.parentId || ''; if (!kids.has(p)) kids.set(p, []); kids.get(p).push(l); }
  const make = (l, parentEl) => {
    const e = P.elements[l.id] || {};
    const box = l.box || { x: 0, y: 0, w: W, h: H };
    const el = document.createElement('div');
    el.dataset.layer = l.id;
    el.style.cssText = `position:absolute;left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px;` +
      `transform-origin:${(l.anchor?.[0] ?? 0.5) * 100}% ${(l.anchor?.[1] ?? 0.5) * 100}%;will-change:transform,opacity`;
    if (l.kind === 'text') {
      const t = l.text || {};
      const inner = document.createElement('div');
      inner.style.cssText = `white-space:pre-wrap;line-height:${t.lineHeight ?? 1.05};letter-spacing:${t.letterSpacing ?? 0}em;` +
        `text-align:${t.align || 'left'};text-transform:${t.transform || 'none'};font-weight:${(e.font && e.font.weight) || t.weight || 700};` +
        `color:${color(e.color, t.color || '#ffffff')};${t.shadow ? 'text-shadow:0 6px 24px rgba(0,0,0,.45);' : ''}display:inline-block;max-width:${box.w}px`;
      if (e.font && Array.isArray(e.font.faces)) inner.style.fontFamily = rt.family(e.font);
      inner.innerHTML = esc(e.text ?? t.value ?? '').replace(/\n/g, '<br>');
      el.appendChild(inner);
      parentEl.appendChild(el);
      fitText(inner, Number(e.fontSize ?? t.fontSize ?? 48), { w: box.w, h: box.h }, t.minSize || 14, issues, l.id);
    } else if (l.kind === 'shape') {
      const s = l.shape || {};
      const svg = document.createElementNS(SVGNS, 'svg');
      svg.setAttribute('width', box.w); svg.setAttribute('height', box.h);
      svg.setAttribute('viewBox', `0 0 ${box.w} ${box.h}`);
      svg.style.overflow = 'visible';
      let g;
      if (s.type === 'ellipse') { g = document.createElementNS(SVGNS, 'ellipse'); g.setAttribute('cx', box.w / 2); g.setAttribute('cy', box.h / 2); g.setAttribute('rx', box.w / 2); g.setAttribute('ry', box.h / 2); }
      else if (s.type === 'path' || s.type === 'line') { g = document.createElementNS(SVGNS, 'path'); g.setAttribute('d', s.d || `M0 ${box.h / 2} L${box.w} ${box.h / 2}`); g.setAttribute('fill', 'none'); }
      else { g = document.createElementNS(SVGNS, 'rect'); g.setAttribute('width', box.w); g.setAttribute('height', box.h); g.setAttribute('rx', s.radius || 0); }
      const fill = color(e.fill, s.fill || 'none');
      if (s.type !== 'path' && s.type !== 'line') g.setAttribute('fill', fill);
      const stroke = color(e.stroke, s.stroke || (s.type === 'path' || s.type === 'line' ? fill : 'none'));
      if (stroke !== 'none') { g.setAttribute('stroke', stroke); g.setAttribute('stroke-width', s.strokeWidth || 4); g.setAttribute('stroke-linecap', 'round'); g.setAttribute('stroke-linejoin', 'round'); }
      svg.appendChild(g); el.appendChild(svg); el._shape = g;
      parentEl.appendChild(el);
      if (g.getTotalLength) try { el._len = g.getTotalLength(); g.style.strokeDasharray = String(el._len); } catch { /* rect in old chrome */ }
    } else if (l.kind === 'image' || l.kind === 'video') {
      const m = document.createElement('img');   // video layers render from their pre-decoded frame sequence
      const fr = l.kind === 'video' && l.video && l.video.frames;
      m.src = fr ? `${fr.dir}/00001.jpg` : (l.image || {}).src;
      m.style.cssText = `width:100%;height:100%;object-fit:${(l.image || l.video || {}).fit || 'cover'};display:block`;
      el.appendChild(m); el._media = m;
      parentEl.appendChild(el);
    } else {
      parentEl.appendChild(el);
    }
    nodes.set(l.id, { l, el });
    for (const c of kids.get(l.id) || []) make(c, el);
  };
  for (const l of kids.get('') || []) make(l, stage);
}

async function waitMedia() {
  const jobs = [];
  for (const { el } of nodes.values()) {
    const m = el._media;
    if (!m) continue;
    if (m.tagName === 'IMG') jobs.push(m.decode ? m.decode().catch(() => {}) : Promise.resolve());
    else if (m.readyState < 2) jobs.push(new Promise((r) => { m.addEventListener('loadeddata', r, { once: true }); m.addEventListener('error', r, { once: true }); }));
  }
  await Promise.all(jobs);
}

async function seek(t) {
  const ms = t * 1000;
  const vids = [];
  for (const { l, el } of nodes.values()) {
    const e = P.elements[l.id] || {};
    const shift = Number(e.keyShiftSec || 0) * 1000;
    const local = ms - shift;
    const on = e.visible !== false && local >= (l.startMs ?? 0) && local < (l.endMs ?? Infinity);
    el.style.visibility = on ? 'visible' : 'hidden';
    if (!on) continue;
    const k = l.keyframes || {};
    const v = {};
    for (const p of NUM) v[p] = sample(k[p], local, p === 'scale' || p === 'opacity' || p === 'draw' ? 1 : 0);
    const x = Number(e.x ?? 0) + v.x, y = Number(e.y ?? 0) + v.y;
    const s = Number(e.scale ?? 1) * v.scale, r = Number(e.rotation ?? 0) + v.rotation;
    el.style.transform = `translate(${x}px,${y}px) rotate(${r}deg) scale(${s})`;
    el.style.opacity = String(Math.max(0, Math.min(1, Number(e.opacity ?? 1) * v.opacity)));
    if (el._shape && el._len) el._shape.style.strokeDashoffset = String(el._len * (1 - Math.max(0, Math.min(1, v.draw))));
    const fr = l.kind === 'video' && l.video && l.video.frames;
    if (fr && el._media) {
      const i = Math.min(fr.count, Math.max(1, Math.floor((local - (l.startMs ?? 0)) / 1000 * fr.fps + 1e-6) + 1));
      const src = `${fr.dir}/${String(i).padStart(5, '0')}.jpg`;
      if (el._media.getAttribute('src') !== src) { el._media.setAttribute('src', src); vids.push(el._media.decode().catch(() => {})); }
    }
  }
  if (vids.length) await Promise.all(vids);
}

build();
await waitMedia();
window.__scene = { fps: spec.fps, duration: DUR, seek };
await seek(0);
window.__ready = true;
rt.attach({
  async apply(next) { P = next; build(); await waitMedia(); },
  layout: () => issues,
  boundsNeedSeek: false,
  bounds() { const out = {}; for (const [id, { el }] of nodes) out[id] = rectOf(el); return out; },
});

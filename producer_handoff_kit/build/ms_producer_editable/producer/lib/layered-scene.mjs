import { spawnSync } from 'node:child_process';
// layered-scene.mjs: turn a layer spec (transovo.layer-scene/1) into an editable browser scene directory.
// Output: index.html, scene.js, layers.json, editable-elements.json (every layer is its own element with
// stable id + editable transform/text/colour/timing), and a transovo.motion-scene-graph/1 tree (parent
// tree + comp-local keyframes) for the Transovo editor's layer list. No AI, no network.
import fs from 'node:fs'; import path from 'node:path';
const ID = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const KINDS = new Set(['group', 'text', 'shape', 'image', 'video']);
const NUMS = ['x', 'y', 'scale', 'rotation', 'opacity', 'draw'];
function bad(m) { throw new Error('layer-scene: ' + m); }

export function validateLayerSpec(s) {
  if (!s || s.schema !== 'transovo.layer-scene/1') bad('schema must be transovo.layer-scene/1');
  if (!ID.test(s.sceneId || '')) bad('sceneId must match ' + ID);
  for (const k of ['width', 'height', 'fps', 'durationMs']) if (!Number.isFinite(s[k]) || s[k] <= 0) bad(k + ' required');
  if (!Array.isArray(s.layers) || !s.layers.length) bad('layers required');
  const ids = new Set();
  for (const l of s.layers) {
    if (!ID.test(l.id || '') || ids.has(l.id) || l.id === 'sceneSettings') bad('bad or duplicate layer id ' + l.id);
    if (!KINDS.has(l.kind)) bad('bad kind for ' + l.id);
    ids.add(l.id);
  }
  for (const l of s.layers) {
    if (l.parentId && (!ids.has(l.parentId) || s.layers.find(x => x.id === l.parentId).kind !== 'group')) bad('parent of ' + l.id + ' must be a group layer');
    for (const [p, keys] of Object.entries(l.keyframes || {})) {
      if (!NUMS.includes(p) || !Array.isArray(keys)) bad('bad keyframe property ' + l.id + '.' + p);
      let prev = -1; for (const k of keys) { if (!Number.isInteger(k.t) || k.t <= prev || k.t > s.durationMs || !Number.isFinite(k.v)) bad('keyframes must be increasing integer ms within the scene: ' + l.id + '.' + p); prev = k.t; }
    }
  }
  const seen = new Set(); for (const l of s.layers) { let p = l.parentId, n = 0; while (p) { if (p === l.id || ++n > 64) bad('parent cycle at ' + l.id); p = s.layers.find(x => x.id === p)?.parentId; } seen.add(l.id); }
  return s;
}

const LIVE_KINDS = new Set(['text', 'shape', 'group', 'image']);
const live = c => ({ ...c, tier: 'live_editable' });
const num = (dflt, min, max, extra = {}) => ({ tier: 'render_editable', type: 'number', default: dflt, min, max, ...extra });
function elementFor(l, s) {
  const box = l.box || { x: 0, y: 0, w: s.width, h: s.height };
  const props = {
    name: { tier: 'live_editable', type: 'text', default: l.name || l.id, maxLines: 1, maxCharsPerLine: 80 },
    locked: { tier: 'live_editable', type: 'boolean', default: false },
    visible: { tier: 'render_editable', type: 'boolean', default: true },
    x: num(0, -8000, 8000, { unit: 'px' }), y: num(0, -8000, 8000, { unit: 'px' }),
    scale: num(1, 0, 20), rotation: num(0, -3600, 3600, { unit: 'deg' }), opacity: num(1, 0, 1),
    keyShiftSec: num(0, -30, 30, { unit: 's' }),
  };
  // Rick (Nov 18): a title/graphic move, recolour, rescale, fade or text change must show immediately in the live
  // browser preview. The ms-layers runtime re-applies these through the same resolver for live and export, so they
  // are live_editable. Render-only stays render_editable: visibility, rotation, key timing shift, font size (auto-fit),
  // and every property of video plates.
  if (LIVE_KINDS.has(l.kind)) for (const k of ['x', 'y', 'scale', 'opacity']) props[k] = { ...props[k], tier: 'live_editable' };
  if (l.kind === 'text') {
    const t = l.text || {};
    props.text = { tier: 'live_editable', type: 'text', default: String(t.value ?? ''), maxLines: t.maxLines || 6, maxCharsPerLine: t.maxCharsPerLine || 80, overflow: 'auto_fit' };
    props.fontSize = num(t.fontSize || 48, t.minSize || 10, 400, { unit: 'px', autoFitMin: t.minSize || 14 });
    props.color = live(HEX.test(t.color || '') ? { type: 'color', default: t.color.toUpperCase() } : { type: 'color', bind: 'colors.' + (t.colorToken || 'text') });
    props.font = { tier: 'ai_editable', type: 'font', bind: 'fonts.' + (t.font || 'display'), roles: [t.font || 'display'] };
  }
  if (l.kind === 'shape') {
    const sh = l.shape || {};
    if (sh.type !== 'path' && sh.type !== 'line') props.fill = live(HEX.test(sh.fill || '') ? { type: 'color', default: sh.fill.toUpperCase() } : { type: 'color', bind: 'colors.' + (sh.fillToken || 'accent') });
    if (sh.stroke || sh.type === 'path' || sh.type === 'line') props.stroke = live(HEX.test(sh.stroke || '') ? { type: 'color', default: sh.stroke.toUpperCase() } : { type: 'color', bind: 'colors.' + (sh.strokeToken || 'accent') });
  }
  return {
    id: l.id, label: l.name || l.id, kind: l.kind === 'video' ? 'video' : l.kind, layer: l.kind === 'shape' ? 'svg' : 'dom',
    selector: `[data-layer=${l.id}]`,
    timing: { inSec: (l.startMs ?? 0) / 1000, outSec: l.endMs != null ? l.endMs / 1000 : null },
    layout: { fitBox: box, parentId: l.parentId || null },
    properties: props,
  };
}

/** transovo.motion-scene-graph/1 tree consumed by the Transovo editor (validated by validateMotionSceneGraph). */
export function motionTreeFor(s) {
  const kf = (l, p, base, factor) => {
    const keys = (l.keyframes || {})[p];
    const out = { type: 'number', value: base, editable: true };
    if (Array.isArray(keys) && keys.length) out.keyframes = keys.map((k, i) => ({ id: `${l.id}_${p}_${i}`, timeMs: k.t, value: k.v, interpolation: k.ease === 'hold' ? 'hold' : k.ease === 'linear' ? 'linear' : 'bezier' }));
    return out;
  };
  const nodes = [{ id: 'root', name: s.title || s.sceneId, kind: 'composition', startMs: 0, endMs: Math.round(s.durationMs), properties: { width: { type: 'number', value: s.width }, height: { type: 'number', value: s.height } } }];
  for (const l of s.layers) {
    const box = l.box || { x: 0, y: 0, w: s.width, h: s.height };
    const props = {
      position: { type: 'vec2', value: [box.x, box.y], editable: true },
      size: { type: 'vec2', value: [box.w, box.h], editable: false },
      x: kf(l, 'x', 0), y: kf(l, 'y', 0), scale: kf(l, 'scale', 1), rotation: kf(l, 'rotation', 0), opacity: kf(l, 'opacity', 1),
    };
    if ((l.keyframes || {}).draw) props.draw = kf(l, 'draw', 1);
    if (l.kind === 'text') props.text = { type: 'text', value: String(l.text?.value ?? ''), editable: true };
    const node = { id: l.id, name: l.name || l.id, kind: l.kind, parentId: l.parentId || 'root', enabled: true, properties: props };
    if (l.startMs != null) node.startMs = Math.round(l.startMs);
    if (l.endMs != null) node.endMs = Math.round(l.endMs);
    nodes.push(node);
  }
  return { schema: 'transovo.motion-scene-graph/1', rootId: 'root', durationMs: Math.round(s.durationMs), nodes };
}

/** Writes the scene directory. files: { 'img/x.png': '/abs/x.png' } copied into the bundle (images/videos). */
export function writeLayeredScene(spec, dir, { files = {}, title } = {}) {
  validateLayerSpec(spec);
  fs.mkdirSync(dir, { recursive: true });
  const videoSrc = new Set(spec.layers.filter(l => l.kind === 'video').map(l => l.video?.src));
  for (const [rel, abs] of Object.entries(files)) {
    if (videoSrc.has(rel)) continue;   // video layers ship as frame sequences (below), not as the mp4
    const d = path.join(dir, rel); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(abs, d);
  }
  const frames = Math.round(spec.durationMs / 1000 * spec.fps);
  // Headless Chrome screenshots do not reliably show a seeked <video> frame, so a video layer (an engine plate,
  // a footage clip) is pre-decoded into a JPEG sequence at the scene fps; the runtime swaps frames exactly.
  spec = { ...spec, layers: spec.layers.map(l => {
    if (l.kind !== 'video') return l;
    const abs = files[l.video?.src];
    if (!abs) throw new Error(`video layer ${l.id}: src ${l.video?.src} is not in the scene files`);
    const start = l.startMs ?? 0, end = Math.min(l.endMs ?? spec.durationMs, spec.durationMs);
    const n = Math.max(1, Math.ceil((end - start) / 1000 * spec.fps));
    const rel = `${l.video.src.replace(/\.[^./]+$/, '')}_${l.id}_frames`;
    const out = path.join(dir, rel); fs.mkdirSync(out, { recursive: true });
    const w = Math.round(l.box?.w ?? spec.width), h = Math.round(l.box?.h ?? spec.height);
    const fit = (l.video.fit || 'cover') === 'contain' ? 'decrease' : 'increase';
    const vf = `fps=${spec.fps},scale=${w}:${h}:force_original_aspect_ratio=${fit}` + (fit === 'increase' ? `,crop=${w}:${h}` : '');
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(l.video.inSec || 0), '-i', abs, '-frames:v', String(n), '-vf', vf, '-q:v', '2', path.join(out, '%05d.jpg')]);
    if (r.status !== 0) throw new Error(`video layer ${l.id}: frame extraction failed: ${String(r.stderr).slice(0, 300)}`);
    const count = fs.readdirSync(out).filter(f => f.endsWith('.jpg')).length;
    return { ...l, video: { ...l.video, frames: { dir: rel, count, fps: spec.fps } } };
  }) };
  const elements = [
    { id: 'sceneSettings', label: 'Scene', kind: 'color', layer: 'dom', properties: { background: HEX.test(spec.background || '') ? { tier: 'render_editable', type: 'color', default: spec.background.toUpperCase() } : { tier: 'render_editable', type: 'color', bind: 'colors.background' } } },
    ...spec.layers.map(l => elementFor(l, spec)),
  ];
  const fonts = [...new Set(spec.layers.filter(l => l.kind === 'text').map(l => 'fonts.' + (l.text?.font || 'display')))];
  const manifest = {
    schema: 'transovo.editable-elements/1', sceneId: spec.sceneId, sceneRevision: spec.revision || 1,
    origin: { designedBy: 'grokbot', designedFromScratch: true, description: spec.description || 'Layered editable scene' },
    format: { width: spec.width, height: spec.height, fps: spec.fps, frames, durationSec: spec.durationMs / 1000, holdFrame: Math.floor(frames / 2) },
    timelinePlacement: { startMs: 0, endMs: Math.round(spec.durationMs) },
    engines: [{ role: 'layers', engine: 'dom', version: '1' }, { role: 'runtime', engine: 'ms-props', version: '1' }],
    fontEngine: 'browser',
    entry: { html: 'index.html', api: 'window.__scene' },
    livePreview: { capability: 'live', fallback: { mode: 'still_then_render' } },
    colorTokensUsed: ['colors.background', 'colors.text', 'colors.accent'], fontTokensUsed: fonts,
    elements,
    protected: [{ what: 'keyframe curves (shift them with keyShiftSec); scene duration' }],
  };
  fs.writeFileSync(path.join(dir, 'layers.json'), JSON.stringify({ ...spec, title: title || spec.title }, null, 1));
  fs.writeFileSync(path.join(dir, 'editable-elements.json'), JSON.stringify(manifest, null, 1));
  fs.writeFileSync(path.join(dir, 'scene.js'), "import './ms/ms-layers.js';\n");
  fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><title>${String(title || spec.sceneId).replace(/[<&]/g, '')}</title>` +
    `<style>html,body{margin:0;padding:0;width:${spec.width}px;height:${spec.height}px;overflow:hidden;background:#000}</style></head>` +
    `<body><div id="stage"></div><script type="module" src="scene.js"></script></body></html>\n`);
  return { manifest, motionTree: motionTreeFor({ ...spec, title }), frames };
}

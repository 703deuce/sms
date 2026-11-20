#!/usr/bin/env node
// build-editable-project.mjs: the default assembly step for every live create_video / revise_video run.
// Input: a project spec JSON (title, format, theme?, narration audio?, scenes[] of transovo.layer-scene/1).
// Output (in --out): rendered scene clips + master MP4 (same browser runtime + assemble() the no-AI
// re-render uses), and payload/publish.json for bin/publish-portable.mjs (POST /portable then /complete).
// Local only: no Transovo calls, no paid APIs.
//   node producer/bin/build-editable-project.mjs --spec project.json --out /workspace/motion_jobs/<jobId>/editable
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { buildBundle, materializeBundle } from '../lib/bundle.mjs';
import { renderBrowser } from '../lib/engines/browser.mjs';
import { collectRefs, sceneRenderKey, masterRenderKey, themeBound, fontMap, PROJECT_SCHEMA } from '../lib/package.mjs';
import { resolve } from '../runtime/ms-resolve.js';
import { assertSchema } from '../lib/schemas.mjs';
import { sha256File, nowIso, mkdirp, writeJson, readJson, run, ffprobe, sha256 } from '../lib/util.mjs';
import { runtimeLock } from '../lib/runtime-lock.mjs';
import { publicRecord } from '../lib/fonts.mjs';
import { assemble } from '../lib/assemble.mjs';
import { writeLayeredScene } from '../lib/layered-scene.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const specPath = arg('--spec'), OUT = path.resolve(arg('--out') || '');
if (!specPath || !arg('--out')) { console.error('usage: --spec project.json --out DIR'); process.exit(2); }
const SPEC = readJson(specPath); const SPEC_DIR = path.dirname(path.resolve(specPath));
const abs = (p) => path.isAbsolute(p) ? p : path.join(SPEC_DIR, p);
process.env.MS_WORK_DIR = process.env.MS_WORK_DIR || path.join(OUT, 'work');
const log = (...a) => console.log('[editable]', ...a);
const PLACEHOLDER = 'PLACEHOLDER_PROJECT_ID';
mkdirp(OUT);

class FileStore {
  constructor(root) { this.root = root; this.rec = new Map(); mkdirp(path.join(root, 'blobs')); }
  _put(buf, { kind, mime, filename, meta }) {
    const sha = sha256(buf); const assetId = (kind === 'font' ? 'fnt_' : kind === 'bundle' ? 'bnd_' : 'ast_') + sha.slice(0, 32);
    const dest = path.join(this.root, 'blobs', sha); if (!fs.existsSync(dest)) fs.writeFileSync(dest, buf);
    this.rec.set(assetId, { assetId, sha256: sha, bytes: buf.length, mime, kind, filename, meta: meta || {}, path: dest });
    return { assetId, sha256: sha, bytes: buf.length, reused: false };
  }
  async uploadFile(file, o = {}) { return this._put(fs.readFileSync(file), { ...o, filename: o.filename || path.basename(file) }); }
  async uploadBuffer(buf, o) { return this._put(Buffer.from(buf), o); }
  uploadJson(obj, o) { return this.uploadBuffer(Buffer.from(JSON.stringify(obj, null, 1)), { kind: 'project', mime: 'application/json', ...o }); }
  async fetchAsset(id) { const a = this.rec.get(id); if (!a) throw new Error('unknown asset ' + id); return { path: a.path, asset: a }; }
  async fetchJson(id) { return JSON.parse(fs.readFileSync((await this.fetchAsset(id)).path, 'utf8')); }
}
const store = new FileStore(path.join(OUT, 'store'));
const fmt = SPEC.format || { width: 1920, height: 1080, fps: 30 };

// fonts: spec.fonts [{file, record}] or the bundled default display face
const fontSpecs = SPEC.fonts?.length ? SPEC.fonts : [{ file: path.join(HERE, '../assets/fonts/BigShouldersDisplay[wght].ttf'), record: path.join(HERE, '../assets/fonts/font-record.json') }];
const fontRecs = [], assetPaths = {}, fontIds = [];
for (const f of fontSpecs) {
  const file = abs(f.file), rec = readJson(abs(f.record));
  if (rec.sha256 !== await sha256File(file)) throw new Error('font sha mismatch ' + file);
  const up = await store.uploadFile(file, { kind: 'font', mime: 'font/ttf', filename: path.basename(file).replace(/[^a-zA-Z0-9._-]/g, '_'), meta: { fontId: rec.fontId } });
  const pub = publicRecord({ ...rec }); delete pub.path; fontRecs.push(pub); fontIds.push(up.assetId);
  assetPaths[rec.fontId.split('.')[0]] = { path: file, mime: 'font/ttf' };
}
const F0 = fontRecs[0].fontId;
const theme = SPEC.theme || {
  schema: 'transovo.motion-theme/1', themeId: 'thm_default_editable', origin: { designedBy: 'grokbot', concept: SPEC.title || 'Editable video' },
  colors: { background: { value: '#0B1220', label: 'Background' }, primary: { value: '#14213D', label: 'Primary' }, secondary: { value: '#C8462C', label: 'Secondary' }, accent: { value: '#FCA311', label: 'Accent' }, text: { value: '#F5F1E8', label: 'Text' } },
  fonts: { display: { faces: [F0], weight: 800, label: 'Display' }, label: { faces: [F0], weight: 500, label: 'Label' } },
  brand: { logo: null },
};
assertSchema('theme', theme);
const fontsHost = Object.fromEntries(fontRecs.flatMap(r => [[r.fontId.split('.')[0], r], [r.fontId, r]]));
const lock = await runtimeLock();
const lockId = (await store.uploadJson(lock, { filename: 'runtime-lock.json' })).assetId;

const sceneDocs = [], bundles = [], segs = {}, needed = new Set([lockId, ...fontIds]);
let cursor = 0;
for (const sc of SPEC.scenes) {
  const spec = { width: fmt.width, height: fmt.height, fps: fmt.fps, ...(sc.spec || readJson(abs(sc.specFile))) };
  const dir = path.join(OUT, 'scenes', spec.sceneId);
  fs.rmSync(dir, { recursive: true, force: true });
  const files = Object.fromEntries(Object.entries(sc.files || {}).map(([r, p]) => [r, abs(p)]));
  const { manifest, motionTree, frames } = writeLayeredScene(spec, dir, { files, title: sc.title || spec.sceneId });
  const b = await buildBundle(store, {
    dir, sceneId: spec.sceneId, revision: spec.revision || 1, engine: 'browser', entry: 'index.html', manifest: 'editable-elements.json',
    capabilities: { livePreview: 'live', editable: true, themeAware: true, fallback: { mode: 'still_then_render' }, requires: { chrome: lock.chrome, fontEngine: 'browser', node: lock.node, ffmpeg: lock.ffmpeg }, deterministic: { level: 'visual', note: 'ms-layers runtime' } },
    runtime: { chrome: lock.chrome, 'ms-props': '1', 'ms-layers': '1' },
    render: { adapter: 'browser-capture', alpha: false, encode: { codec: 'h264', profile: 'high', level: '4.2', crf: 18, preset: 'medium' } },
    createdBy: { mode: 'editable_assembly', from: SPEC.title || 'video' },
  });
  const mat = path.join(OUT, 'work', 'materialized', spec.sceneId);
  await materializeBundle(store, b.bundleId, mat, path.join(OUT, 'work', 'cache'));
  const clip = path.join(OUT, 'clips', spec.sceneId + '.mp4'); mkdirp(path.dirname(clip));
  const host = { theme, overrides: { schema: 'transovo.edit-patch/1', scenes: {} }, fonts: fontsHost, assets: {}, mode: 'render' };
  const r = await renderBrowser({ bundleDir: mat, entry: 'index.html', host, assetPaths, out: clip, from: 0, to: spec.durationMs / 1000, fps: fmt.fps, width: fmt.width, height: fmt.height, crf: 18 });
  if (!r.ok) throw new Error('scene render failed ' + spec.sceneId + ': ' + JSON.stringify({ issues: r.issues, errors: r.errors }).slice(0, 600));
  const up = await store.uploadFile(clip, { kind: 'video', mime: 'video/mp4', filename: spec.sceneId + '.mp4', meta: { role: 'scene_clip' } });
  segs[spec.sceneId] = clip; needed.add(up.assetId); needed.add(b.bundleId);
  for (const f of Object.values(b.doc.files)) needed.add(f.asset);
  for (const x of (b.doc.dependencies?.assets || [])) needed.add(x);
  const startSec = cursor, endSec = cursor + spec.durationMs / 1000; cursor = endSec;
  sceneDocs.push({ sceneId: spec.sceneId, bundle: b.bundleId, editable: true, themeAware: true, role: 'scene',
    timeline: { startSec, endSec, frames }, clip: { asset: up.assetId, renderKey: sceneRenderKey({ bundleId: b.bundleId, resolved: resolve(b.manifest, theme, { schema: 'transovo.edit-patch/1', scenes: {} }, { mode: 'render', fonts: fontMap({ fontRecords: fontRecs }), assets: {} }), runtimeLock: lockId }), frames, renderedInVersion: 1, origin: 'local_render' },
    preview: null, narrationRefs: [] });
  bundles.push({ sceneId: spec.sceneId, bundleId: b.bundleId, sha256: store.rec.get(b.bundleId).sha256, engine: 'browser', runtime: 'chrome',
    manifest: { elements: b.manifest.elements, livePreview: b.manifest.livePreview, motionTree },
    dependencies: Object.values(b.doc.files).map(f => f.asset) });
  log('scene', spec.sceneId, 'layers', spec.layers.length, 'frames', frames, 'renderMs', r.renderMs);
}

const totalSec = cursor, totalFrames = Math.round(totalSec * fmt.fps);
let audioFile = SPEC.audio?.file ? abs(SPEC.audio.file) : null, silent = false;
if (!audioFile) { audioFile = path.join(OUT, 'silence.wav'); silent = true; await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', String(totalSec), '-c:a', 'pcm_s16le', audioFile]); }
const audioUp = await store.uploadFile(audioFile, { kind: 'audio', mime: /\.m4a$/i.test(audioFile) ? 'audio/mp4' : /\.mp3$/i.test(audioFile) ? 'audio/mpeg' : 'audio/wav', filename: path.basename(audioFile), meta: { role: silent ? 'silent_bed' : 'mix' } });
needed.add(audioUp.assetId);
let start = 0;
const recipe = { schema: 'transovo.assembly/1', format: { width: fmt.width, height: fmt.height, fps: fmt.fps }, compiledFrom: 'editable layered scenes',
  segments: sceneDocs.map(s => { const seg = { id: s.sceneId, source: { scene: s.sceneId }, frames: s.timeline.frames, startSec: start, endSec: start + s.timeline.frames / fmt.fps,
    filters: [{ f: 'fps', fps: fmt.fps }, { f: 'format', pix_fmts: 'yuv420p' }, { f: 'setsar', r: 1 }, { f: 'trim', end_frame: s.timeline.frames }, { f: 'setpts', expr: 'PTS-STARTPTS' }] }; start = seg.endSec; return seg; }),
  audio: { asset: audioUp.assetId, silent, bitrate: silent ? '64k' : '192k', shortest: true },
  encode: { codec: 'h264', profile: 'high', level: '4.2', crf: 18, preset: 'medium' }, totalFrames };
assertSchema('assembly-recipe', recipe);
const recipeId = (await store.uploadJson(recipe, { filename: 'assembly-recipe.json' })).assetId; needed.add(recipeId);
const master = path.join(OUT, 'master.mp4');
await assemble(recipe, { segments: segs, overlays: {}, audio: audioFile }, themeBound(recipe, theme), master, { workDir: path.join(OUT, 'work') });
const probe = await ffprobe(master); const durationMs = Math.round(Number(probe.format?.duration) * 1000);
const masterUp = await store.uploadFile(master, { kind: 'video', mime: 'video/mp4', filename: 'master.mp4', meta: { role: 'master' } }); needed.add(masterUp.assetId);
mkdirp(path.join(OUT, 'frames'));
for (const t of [0.5, totalSec / 2, Math.max(0, totalSec - 0.2)]) await run('ffmpeg', ['-y', '-v', 'error', '-ss', t.toFixed(2), '-i', master, '-frames:v', '1', '-update', '1', path.join(OUT, 'frames', `t_${t.toFixed(2)}s.png`)]);

const doc = { schema: PROJECT_SCHEMA, projectId: PLACEHOLDER, version: 1, parentVersion: null, title: SPEC.title || 'Video', createdAt: nowIso(),
  createdBy: { mode: 'import', note: 'editable layered assembly' }, changes: [{ type: 'import', note: 'every scene published as editable layers' }],
  format: { width: fmt.width, height: fmt.height, fps: fmt.fps, durationSec: totalSec }, theme, overrides: { schema: 'transovo.edit-patch/1', scenes: {} },
  fontRecords: fontRecs, scenes: sceneDocs, sources: { note: silent ? 'silent bed' : 'final audio mix' }, runtimeLock: lockId,
  master: { recipe: recipeId, asset: masterUp.assetId, renderKey: masterRenderKey({ recipe: recipeId, segmentClips: sceneDocs.map(s => s.clip.asset), themeBound: themeBound(recipe, theme), runtimeLock: lockId }), renderedInVersion: 1, origin: 'local_render', encode: recipe.encode },
  validation: { status: 'ok', issues: [] }, assetRefs: [] };
doc.assetRefs = collectRefs(doc); for (const x of doc.assetRefs) needed.add(x);
assertSchema('project-version', doc);
const assets = [...needed].sort().map(id => { const r = store.rec.get(id); if (!r) throw new Error('store missing ' + id); return { id, sha256: r.sha256, kind: r.kind, mime: r.mime, bytes: r.bytes, filename: r.filename, file: path.relative(OUT, r.path) }; });
mkdirp(path.join(OUT, 'payload'));
writeJson(path.join(OUT, 'payload', 'publish.json'), { placeholderProjectId: PLACEHOLDER, durationMs, document: doc, assets, bundles, local: { master: 'master.mp4', frames: 'frames' } });
log('done', { scenes: sceneDocs.length, durationMs, assets: assets.length, payload: path.join(OUT, 'payload', 'publish.json') });

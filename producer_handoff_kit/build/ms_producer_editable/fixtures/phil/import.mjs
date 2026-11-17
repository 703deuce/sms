// Import the finished Phil Blount 30 s vertical film (1080x1920) as project phil_30s v1.
// Editable: S04 (PixiJS record, live) and sh04 (Python/OpenCV face-tracked shot, render-only). Everything else reused as-is.
import fs from 'node:fs'; import path from 'node:path';
import { StoreClient } from '../../producer/lib/store-client.mjs'; import { buildBundle, uploadAsset } from '../../producer/lib/bundle.mjs';
import { scanFonts, publicRecord } from '../../producer/lib/fonts.mjs';
import { resolveScene, sceneRenderKey, masterRenderKey, collectRefs, themeBound, PROJECT_SCHEMA } from '../../producer/lib/package.mjs';
import { assertSchema } from '../../producer/lib/schemas.mjs'; import { readJson, writeJson, nowIso, run, walk } from '../../producer/lib/util.mjs';
import { runtimeLock } from '../../producer/lib/runtime-lock.mjs'; import { CFG } from '../../producer/lib/config.mjs';
const API = 'http://127.0.0.1:8787/api/motion-studio', PID = 'phil_30s', R = '/workspace/motion_tests/phil_blount_30s', FX = path.dirname(new URL(import.meta.url).pathname);
const t0 = Date.now(); const log = (...a) => console.log(`[import phil ${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const j = await (await fetch(API + '/_sim/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: PID, mode: 'import', action: 'import_finished_film' }) })).json();
const store = new StoreClient({ apiBase: j.apiBase, jobToken: j.jobToken });
const up = async (rel, meta = {}) => (await uploadAsset(store, path.join(R, rel), meta)).assetId;
const upMany = async (dir, filt = () => true) => { const out = {}; for (const f of walk(path.join(R, dir), (x, d) => d || filt(x))) out[f] = await up(path.join(dir, f)); return out; };
const ff = ['Unbounded-Black.ttf', 'JetBrainsMono-Bold.ttf', 'Sora-ExtraBold.ttf'].map(f => path.join(R, 'assets/fonts', f)); const frecs = await scanFonts(ff);
for (const r of frecs) await store.uploadFile(r.path, { kind: 'font', mime: 'font/ttf', filename: path.basename(r.path) });
const fid = n => frecs.find(r => path.basename(r.path) === n).fontId;
const theme = { schema: 'transovo.motion-theme/1', themeId: 'thm_pressed_203', origin: { designedBy: 'grokbot', concept: 'Pressed in the 203' },
  colors: { accent: { value: '#FF2D87', label: 'Magenta (label, VU, dust)' }, ink: { value: '#08080B', label: 'Jet (ink)' }, deep: { value: '#2A0A1C', label: 'Deep plum' } },
  fonts: { display: { faces: [fid('Unbounded-Black.ttf')], weight: 900, label: 'Unbounded Black' }, mono: { faces: [fid('JetBrainsMono-Bold.ttf')], weight: 700, label: 'JetBrains Mono Bold' }, caption: { faces: [fid('Sora-ExtraBold.ttf')], weight: 800, label: 'Sora ExtraBold' } }, brand: { logo: null } };
const lock = await runtimeLock(); const lockId = (await store.uploadJson(lock, { filename: 'runtime-lock.json' })).assetId;
// sh04: footage + stored face track (computed once with the production detector)
const shots = readJson(path.join(R, 'scenes/footage/shots.json')); const s4 = shots.find(s => s.id === 'sh04');
const footage = {}; for (const f of [...new Set(shots.map(s => s.src))]) footage[f] = await up('assets/footage/' + f, { role: 'raw_footage' });
const trackFile = path.join(CFG.workDir, 'tmp', 'phil_sh04_track.json'); fs.mkdirSync(path.dirname(trackFile), { recursive: true });
await run('/workspace/motion_engines/mediapipe/venv/bin/python', [path.join(FX, 'sh04/track.py'), path.join(R, 'assets/footage', s4.src), String(s4.s), String(s4.t0), String(s4.t1), '/workspace/motion_engines/mediapipe/models/blaze_face_full_range.tflite', trackFile]);
const trackId = (await uploadAsset(store, trackFile, { role: 'face_track', shot: 'sh04' })).assetId;
const pyCaps = { livePreview: 'render_only', editable: true, themeAware: false, fallback: { mode: 'still_then_render' }, requires: { python: lock.python, pythonPackages: { 'opencv-python': lock.pythonPackages['opencv-python'], numpy: lock.pythonPackages.numpy }, ffmpeg: lock.ffmpeg }, deterministic: { level: 'visual', note: 'stored face track; OpenCV Lanczos warp + x264 crf 15' } };
const bSh04 = await buildBundle(store, { dir: path.join(FX, 'sh04'), sceneId: 'sh04', revision: 1, engine: 'python', entry: null, manifest: 'editable-elements.json', exclude: ['track.py'], vars: { footage: footage[s4.src], track: trackId },
  capabilities: pyCaps, runtime: { python: lock.python, opencv: lock.pythonPackages['opencv-python'] }, render: { adapter: 'python-video', python: 'cv', script: 'render.py', args: ['--props', '{props}', '--out', '{out}', '--work', '{work}', '--mode', '{mode}', '--still', '{still}'] },
  dependencies: { assets: [footage[s4.src], trackId] }, createdBy: { mode: 'import', from: 'production scenes/footage/render_shots.py (sh04, parameterized)' } });
const brCaps = (ed) => ({ livePreview: ed ? 'live' : 'render_only', editable: ed, themeAware: ed, fallback: { mode: ed ? 'poster_then_render' : 'rendered_clip' }, requires: { chrome: lock.chrome, webgl: 'webgl1', fontEngine: 'browser' }, deterministic: { level: 'visual' } });
const bS04 = await buildBundle(store, { dir: path.join(FX, 'S04'), sceneId: 'S04', revision: 1, engine: 'browser', entry: 'index.html', manifest: 'editable-elements.json', capabilities: brCaps(true), runtime: { chrome: lock.chrome, pixi: '8' }, render: { adapter: 'browser-capture', alpha: true }, createdBy: { mode: 'import', from: 'production scenes/S04 (parameterized)' } });
const bS06 = await buildBundle(store, { dir: path.join(R, 'scenes/S06'), sceneId: 'S06', revision: 1, engine: 'browser', entry: 'index.html', manifest: null, capabilities: brCaps(false), runtime: { chrome: lock.chrome }, render: { adapter: 'browser-capture', alpha: true }, createdBy: { mode: 'import', from: 'production scenes/S06 (original)' } });
const bTY = await buildBundle(store, { dir: path.join(R, 'scenes/overlay'), sceneId: 'TY', revision: 1, engine: 'clip', entry: null, manifest: null, capabilities: { livePreview: 'render_only', editable: false, themeAware: false, fallback: { mode: 'rendered_clip' }, requires: { node: lock.node }, note: 'CanvasKit (skia wasm) type layer in Node; not re-rendered by this worker (untested), clip reused' }, runtime: { canvaskit: lock.canvaskit }, render: { adapter: 'static-clip' }, createdBy: { mode: 'import', from: 'production scenes/overlay (original)' } });
log('bundles', bSh04.bundleId, bS04.bundleId, bS06.bundleId, bTY.bundleId);
const ORDER = ['sh01', 'sh02', 'sh03', 'sh04', 'sh05a', 'sh05b', 'plate04', 'sh06', 'plate06', 'sh07', 'sh08', 'sh09', 'sh10', 'sh11'];
const extracted = {}; for (const s of ORDER) extracted[s] = await up(`scenes/footage/out/${s}.mp4`, { role: s === 'sh04' ? 'scene_clip' : 'extracted_footage', shot: s, origin: 'production' });
const S04clip = await up('scenes/S04/out/S04.mov', { role: 'scene_clip', origin: 'production' }), S06clip = await up('scenes/S06/out/S06.mov', { role: 'scene_clip', origin: 'production' });
const TY = []; for (let i = 0; i < 4; i++) TY.push(await up(`scenes/overlay/out/part${i}.mov`, { role: 'overlay_clip', part: i }));
const sources = { shots: await up('scenes/footage/shots.json'), renderShots: await up('scenes/footage/render_shots.py'), assemble: await up('assemble.sh'), projectJson: await up('deliver/project.json'), assetsManifest: await up('deliver/assets-manifest.json'),
  narration: { voRaw: await up('audio/vo_raw.mp3'), voWords: await up('audio/vo_words_raw.json'), alignment: await up('audio/vo_alignment.json'), timeline: await up('audio/timeline.json'), captions: await up('scenes/overlay/captions.json') },
  mix: await up('audio/mix_final.wav'), stems: await upMany('stems'), music: await up('audio/music.wav', { role: 'music', note: 'procedural 88 BPM bed (production)' }), footage, photos: await upMany('assets/photos'), workScripts: await upMany('work', f => /\.(py|json|txt)$/.test(f) && !f.includes('__pycache__')) };
const GRADE = [{ f: 'eq', contrast: 1.10, saturation: 1.10, gamma: 0.97 }, { f: 'colorbalance', rs: 0.05, gs: -0.03, bs: 0.04 }], PLATE = [{ f: 'eq', brightness: -0.16, saturation: 0.75, contrast: 1.05 }, { f: 'colorbalance', rs: 0.10, gs: -0.04, bs: 0.07, rm: 0.06, bm: 0.04 }];
const recipe = { schema: 'transovo.assembly/1', format: { width: 1080, height: 1920, fps: 30 }, compiledFrom: 'assemble.sh (same filter graph, declarative)',
  segments: ORDER.map(s => ({ id: s, source: s === 'sh04' ? { scene: 'sh04' } : { asset: extracted[s] }, frames: null, filters: [{ f: 'setpts', expr: 'PTS-STARTPTS' }, ...(s.startsWith('plate') ? PLATE : GRADE), { f: 'format', pix_fmts: 'yuv420p' }] })),
  groupFilters: [{ f: 'format', pix_fmts: 'gbrp' }],
  overlays: [{ id: 'S04', scene: 'S04', filters: [{ f: 'setpts', expr: 'PTS-STARTPTS+308/30/TB' }, { f: 'format', pix_fmts: 'yuva444p' }], overlay: { x: 0, y: 0, eof_action: 'pass', format: 'gbrp' } },
    { id: 'S06', scene: 'S06', filters: [{ f: 'setpts', expr: 'PTS-STARTPTS+557/30/TB' }, { f: 'format', pix_fmts: 'yuva444p' }], overlay: { x: 0, y: 0, eof_action: 'pass', format: 'gbrp' } },
    { id: 'TY', scene: 'TY', parts: 4, filters: [{ f: 'setpts', expr: 'PTS-STARTPTS' }, { f: 'format', pix_fmts: 'yuva444p' }], overlay: { x: 0, y: 0, format: 'gbrp' } }],
  post: [{ f: 'vignette', angle: 'PI/5' }, { f: 'noise', alls: 5, allf: 't' }, { f: 'format', pix_fmts: 'yuv420p' }, { f: 'setsar', r: 1 }],
  audio: { asset: sources.mix, filters: [{ f: 'apad' }, { f: 'atrim', start: 0, end: 31.2 }], bitrate: '160k', rate: 48000 }, totalFrames: 936,
  encode: { codec: 'h264', twoPass: true, bitrate: '4300k', maxrate: '7M', bufsize: '9M', preset: 'slow', gop: 15, bt709: true, level: '4.2' }, themeBindings: {} };
recipe.segments.forEach(s => { delete s.frames; }); assertSchema('assembly-recipe', recipe);
const recipeId = (await store.uploadJson(recipe, { filename: 'assembly-recipe.json' })).assetId; const master = await up('deliver/phil_blount_30s_1080x1920.mp4', { role: 'master', origin: 'production' });
const poster = async (src, f, name) => { const o = `/tmp/phil_${name}.jpg`; await run('ffmpeg', ['-y', '-v', 'error', '-i', src, '-vf', `select=eq(n\\,${f})`, '-frames:v', '1', '-q:v', '3', o]); return (await uploadAsset(store, o, { role: 'poster' })).assetId; };
const doc = { schema: PROJECT_SCHEMA, projectId: PID, version: 1, parentVersion: null, title: 'Phil Blount: Pressed in the 203 (30 s, 9:16)', createdAt: nowIso(), createdBy: { mode: 'import', jobId: j.jobId, workerId: 'importer' },
  changes: [{ type: 'import' }], format: { width: 1080, height: 1920, fps: 30, durationSec: 31.2 }, theme, overrides: { schema: 'transovo.edit-patch/1', scenes: {} },
  fontRecords: frecs.map(r => { const p = publicRecord(r); delete p.path; return p; }), scenes: [], sources, runtimeLock: lockId };
const assets = {}; const issues = [];
const add = async (sid, b, clip, extra) => { const resolved = b.manifest ? resolveScene(b.manifest, doc, { assets }) : null; if (resolved) issues.push(...resolved.issues);
  doc.scenes.push({ sceneId: sid, bundle: b.bundleId, editable: !!b.manifest, themeAware: !!(b.manifest && b.manifest.fontEngine), role: extra.role, timeline: extra.timeline, clip: { ...clip, renderKey: sceneRenderKey({ bundleId: b.bundleId, resolved, runtimeLock: lockId }), renderedInVersion: 1, origin: 'production' }, preview: extra.preview || null, narrationRefs: [] }); };
await add('sh04', bSh04, { asset: extracted.sh04, frames: 72 }, { role: 'segment', timeline: { startSec: 4.44, endSec: 6.84, frames: 72 }, preview: { poster: await poster(path.join(R, 'scenes/footage/out/sh04.mp4'), 36, 'sh04') } });
await add('S04', bS04, { asset: S04clip, frames: 164 }, { role: 'overlay', timeline: { startSec: 308 / 30, endSec: (308 + 164) / 30, frames: 164 }, preview: { poster: await poster(path.join(R, 'scenes/S04/out/S04.mov'), 60, 'S04') } });
await add('S06', bS06, { asset: S06clip }, { role: 'overlay', timeline: { startSec: 557 / 30, endSec: 557 / 30 + 3.47, frames: 104 } });
await add('TY', bTY, { asset: TY[0], parts: TY }, { role: 'overlay', timeline: { startSec: 0, endSec: 31.2, frames: 936 } });
doc.master = { recipe: recipeId, asset: master, renderKey: masterRenderKey({ recipe: recipeId, segmentClips: doc.scenes.map(s => s.clip.asset), themeBound: themeBound(recipe, theme), runtimeLock: lockId }), renderedInVersion: 1, origin: 'production' };
doc.validation = { status: issues.some(i => i.severity === 'error') ? 'errors' : 'ok', issues }; doc.assetRefs = collectRefs(doc); assertSchema('project-version', doc);
const r = await store.publishVersion(PID, 0, doc); log('published', JSON.stringify(r), 'assets', doc.assetRefs.length, 'issues', issues.map(i => i.code).join(',') || 'none');
await store.complete(j.jobId, { status: 'completed', projectVersion: 1 });

#!/usr/bin/env node
// publish-live.mjs: LIVE delivery (job.delivery.mode === 'live'). Builds the approved film as a
// transovo.live-project/1 timeline + immutable producer document + registered scene bundles, footage
// layers (inside the bundles), editable text/caption tracks and grouped audio stems, WITHOUT rendering
// any scene clip, master or editor-base MP4. Then (live mode only) uploads every asset 8 at a time,
// confirms each one landed, POSTs {jobUrl}/portable and completes with
// {delivery:'live', portableVersionId, durationMs}.
//
// Server contract checked against 703deuce/sms master @ 5dbe6b721 (2026-11-18):
//   new-app/lib/motion-studio/portable-contract.ts      validatePortableManifest (liveProject block)
//   new-app/lib/server/motion-studio/portable-projects.ts publishPortableVersion (document | manifest, + liveProject)
//   new-app/lib/server/motion-studio/agent-bridge.ts     botAssets (prepare/commit/receipts), botFinish (delivery:'live')
//   new-app/lib/motion-studio/universal-timeline.ts      normalizeUniversalTimeline (what the browser player reads)
// --dry-run runs those exact validators locally (snapshot in transovo_contract/master-5dbe6b72/). No network.
//
//   node producer/bin/publish-live.mjs --spec SPEC.json --out DIR [--project-id ID] [--job-dir JOBDIR] [--dry-run] [--no-complete]
// SPEC = the build-editable-project.mjs spec (title, format, theme?, fonts, audio.file = approved mix, scenes[])
//        plus  live: { stems: { main_voice:[{file,label?,gainDb?}], adlibs:[...], other_audio:[...] },
//                      captions: "<transovo.captions/1 JSON | .vtt | .srt>",  transitions?: {sceneId:{type:'cut'}} }
// Credentials (live mode only): JOBDIR/secrets/{job_url,token} (mode 600) or MOTION_STUDIO_JOB_URL / MOTION_STUDIO_JOB_TOKEN.
// Never logs tokens, signed URLs or Authorization headers.
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { register } from 'node:module';

const SELF = path.dirname(fileURLToPath(import.meta.url));
if (!process.execArgv.some(a => a.includes('strip-types'))) {
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', fileURLToPath(import.meta.url), ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
  process.exit(r.status ?? 1);
}
register(pathToFileURL(path.join(SELF, 'ts-ext-loader.mjs')).href);

const argv = process.argv.slice(2);
const arg = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const flag = n => argv.includes(n);
const specPath = arg('--spec'), OUT = path.resolve(arg('--out') || '');
if (!specPath || !arg('--out')) { console.error('usage: --spec SPEC.json --out DIR [--project-id ID] [--job-dir JOBDIR] [--dry-run] [--no-complete]'); process.exit(2); }
const DRY = flag('--dry-run');
const JOB_DIR = arg('--job-dir') ? path.resolve(arg('--job-dir')) : (process.env.MOTION_STUDIO_JOB_DIR || null);
process.env.MS_WORK_DIR = process.env.MS_WORK_DIR || path.join(OUT, 'work');

const CONTRACT = process.env.MS_CONTRACT_DIR || path.join(SELF, '../../transovo_contract/master-5dbe6b72');
const { validatePortableManifest } = await import(pathToFileURL(path.join(CONTRACT, 'portable-contract.ts')).href);
const { validateNativeProducerEnvelope } = await import(pathToFileURL(path.join(CONTRACT, 'producer-project-adapter.ts')).href);
const { normalizeUniversalTimeline } = await import(pathToFileURL(path.join(CONTRACT, 'universal-timeline.ts')).href);
const { buildBundle } = await import('../lib/bundle.mjs');
const { collectRefs, themeBound, PROJECT_SCHEMA } = await import('../lib/package.mjs');
const { assertSchema, check } = await import('../lib/schemas.mjs');
const { sha256File, nowIso, mkdirp, writeJson, readJson, sha256 } = await import('../lib/util.mjs');
const { runtimeLock } = await import('../lib/runtime-lock.mjs');
const { publicRecord } = await import('../lib/fonts.mjs');
const { writeLayeredScene } = await import('../lib/layered-scene.mjs');

const log = (...a) => console.log('[live]', ...a);
const SPEC = readJson(specPath); const SPEC_DIR = path.dirname(path.resolve(specPath));
const abs = p => path.isAbsolute(p) ? p : path.join(SPEC_DIR, p);
mkdirp(OUT);

// ---------- local content-addressed store (same ids as build-editable-project.mjs) ----------
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
const probeMs = file => {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], { encoding: 'utf8' });
  const ms = Math.round(Number(r.stdout) * 1000); if (!Number.isSafeInteger(ms) || ms <= 0) throw new Error('cannot read duration: ' + path.basename(file)); return ms;
};

// ---------- 1. build (no render, no encode) ----------
const fmt = SPEC.format || { width: 1920, height: 1080, fps: 30 };
const LIVE = SPEC.live || {};
if (!SPEC.fonts?.length) throw new Error('spec.fonts required (the film\'s own type system)');
const fontRecs = [], fontIds = [], fontsLive = {};
for (const f of SPEC.fonts) {
  const file = abs(f.file), rec = readJson(abs(f.record));
  if (rec.sha256 !== await sha256File(file)) throw new Error('font sha mismatch ' + path.basename(file));
  const up = await store.uploadFile(file, { kind: 'font', mime: 'font/ttf', filename: path.basename(file).replace(/[^a-zA-Z0-9._-]/g, '_'), meta: { fontId: rec.fontId } });
  const pub = publicRecord({ ...rec }); delete pub.path; fontRecs.push(pub); fontIds.push(up.assetId);
  fontsLive[rec.fontId.split('.')[0]] = { src: up.assetId, record: pub };
}
const theme = SPEC.theme; if (!theme) throw new Error('spec.theme required (no default look)');
assertSchema('theme', theme);
const lock = await runtimeLock();
const lockId = (await store.uploadJson(lock, { filename: 'runtime-lock.json' })).assetId;
const needed = new Set([lockId, ...fontIds]);
const sceneDocs = [], bundles = [], sceneItems = [], textItems = [], footageItems = [];
let cursorMs = 0;
for (const sc of SPEC.scenes) {
  const spec = { width: fmt.width, height: fmt.height, fps: fmt.fps, ...(sc.spec || readJson(abs(sc.specFile))) };
  if (!Number.isSafeInteger(spec.durationMs) || spec.durationMs < 1) throw new Error('scene durationMs must be a positive integer: ' + spec.sceneId);
  const dir = path.join(OUT, 'scenes', spec.sceneId); fs.rmSync(dir, { recursive: true, force: true });
  const files = Object.fromEntries(Object.entries(sc.files || {}).map(([r, p]) => [r, abs(p)]));
  const { manifest, motionTree, frames } = writeLayeredScene(spec, dir, { files, title: sc.title || spec.sceneId });
  const b = await buildBundle(store, {
    dir, sceneId: spec.sceneId, revision: spec.revision || 1, engine: 'browser', entry: 'index.html', manifest: 'editable-elements.json',
    capabilities: { livePreview: 'live', editable: true, themeAware: true, fallback: { mode: 'still_then_render' }, requires: { chrome: lock.chrome, fontEngine: 'browser', node: lock.node, ffmpeg: lock.ffmpeg }, deterministic: { level: 'visual', note: 'ms-layers runtime' } },
    runtime: { chrome: lock.chrome, 'ms-props': '1', 'ms-layers': '1' },
    render: { adapter: 'browser-capture', alpha: false, encode: { codec: 'h264', profile: 'high', level: '4.2', crf: 18, preset: 'medium' } },
    createdBy: { mode: 'live_delivery', from: SPEC.title || 'video' },
  });
  needed.add(b.bundleId); for (const f of Object.values(b.doc.files)) needed.add(f.asset); for (const x of (b.doc.dependencies?.assets || [])) needed.add(x);
  const startMs = cursorMs, durationMs = spec.durationMs; cursorMs += durationMs;
  sceneDocs.push({ sceneId: spec.sceneId, bundle: b.bundleId, editable: true, themeAware: true, role: 'scene',
    timeline: { startSec: startMs / 1000, endSec: (startMs + durationMs) / 1000, startMs, durationMs, frames }, preview: null, narrationRefs: [] });
  bundles.push({ sceneId: spec.sceneId, bundleId: b.bundleId, sha256: store.rec.get(b.bundleId).sha256, engine: 'browser', runtime: 'chrome',
    manifest: { elements: b.manifest.elements, livePreview: b.manifest.livePreview, motionTree },
    dependencies: [...new Set(Object.values(b.doc.files).map(f => f.asset))] });
  sceneItems.push({ id: spec.sceneId, type: 'scene', sceneId: spec.sceneId, engine: 'browser', runtime: 'ms-layers/1', delivery: 'live',
    startMs, durationMs, frames, sceneInMs: 0, transitionIn: (LIVE.transitions || {})[spec.sceneId] || { type: 'cut' }, label: sc.title || spec.sceneId });
  for (const l of spec.layers) {
    const ls = Math.max(0, l.startMs ?? 0), le = Math.min(durationMs, l.endMs ?? durationMs);
    if (le <= ls) continue;
    const item = { id: spec.sceneId + '.' + l.id, type: 'sceneLayer', sceneId: spec.sceneId, elementId: l.id, layerKind: l.kind, label: l.name || l.id,
      startMs: startMs + ls, durationMs: le - ls, endMs: startMs + le };
    if (l.kind === 'text') textItems.push(item); else if (l.kind === 'video' || l.kind === 'image') footageItems.push(item);
  }
  log('scene', spec.sceneId, 'layers', spec.layers.length, 'frames', frames, '(bundle only, no render)');
}
const durationMs = cursorMs, totalFrames = Math.round(durationMs * fmt.fps / 1000);

// grouped stems (Rick: Main Voice, Ad-libs, Main Visuals, Text, Other audio)
const stemTracks = { main_voice: 'Main Voice', adlibs: 'Ad-libs', other_audio: 'Other audio' };
const audioTracks = [];
const stems = LIVE.stems || {};
if (!(stems.main_voice || []).length && !(stems.other_audio || []).length) throw new Error('live.stems needs at least main_voice or other_audio');
for (const [trackId, label] of Object.entries(stemTracks)) {
  const items = [];
  for (const [i, s] of (stems[trackId] || []).entries()) {
    const file = abs(s.file); const ms = probeMs(file);
    if (Math.abs(ms - durationMs) > 1000 / fmt.fps * 2 && !s.startMs) log(`WARN stem ${path.basename(file)} is ${ms} ms vs film ${durationMs} ms`);
    const up = await store.uploadFile(file, { kind: 'audio', mime: /\.mp3$/i.test(file) ? 'audio/mpeg' : /\.m4a$/i.test(file) ? 'audio/mp4' : 'audio/wav', filename: trackId + '_' + path.basename(file).replace(/[^a-zA-Z0-9._-]/g, '_'), meta: { role: 'stem', trackId } });
    needed.add(up.assetId);
    const startMs = s.startMs || 0;
    items.push({ id: `${trackId}_${i + 1}`, type: 'audio', src: up.assetId, sha256: up.sha256, label: s.label || path.basename(file),
      startMs, inMs: s.inMs || 0, durationMs: Math.min(ms - (s.inMs || 0), durationMs - startMs), gainDb: s.gainDb ?? 0, muted: false });
  }
  audioTracks.push({ id: trackId, label, kind: 'audio', gainDb: 0, items });
}
// approved mix: export recipe audio (never used for preview; the player plays the stems)
if (!SPEC.audio?.file) throw new Error('spec.audio.file (approved mix) required for the export recipe');
const mixUp = await store.uploadFile(abs(SPEC.audio.file), { kind: 'audio', mime: 'audio/wav', filename: 'mix.wav', meta: { role: 'mix' } }); needed.add(mixUp.assetId);

// captions: one separate, editable text track; never burned in
let captionsId = null, cueCount = 0;
if (LIVE.captions) {
  const raw = fs.readFileSync(abs(LIVE.captions), 'utf8'); let doc;
  if (/^\s*[{[]/.test(raw)) { doc = JSON.parse(raw); }
  else { // VTT / SRT -> transovo.captions/1 JSON (the only caption mime both the upload and scene host accept as-is)
    const t = s => { const p = s.trim().replace(',', '.').split(':').map(Number); return Math.round(((p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1])) * 1000); };
    const cues = raw.replace(/^WEBVTT[^\n]*\n/, '').split(/\r?\n\s*\r?\n/).flatMap((blk, i) => { const ls = blk.trim().split(/\r?\n/); const at = ls.findIndex(x => x.includes('-->')); if (at < 0) return []; const [a, b] = ls[at].split('-->'); return [{ id: 'c' + String(i + 1).padStart(3, '0'), startMs: t(a), endMs: t(b.trim().split(/\s/)[0]), text: ls.slice(at + 1).join('\n').trim() }]; });
    doc = { schema: 'transovo.captions/1', burnedIn: false, cues };
  }
  const cues = Array.isArray(doc) ? doc : doc.cues;
  if (!Array.isArray(cues) || !cues.length) throw new Error('captions file has no cues');
  if (doc.burnedIn === true) throw new Error('captions must never be burned in');
  cueCount = cues.length;
  captionsId = (await store.uploadJson({ ...(Array.isArray(doc) ? { schema: 'transovo.captions/1', cues: doc } : doc), burnedIn: false }, { filename: 'captions.json', meta: { role: 'captions' } })).assetId;
  needed.add(captionsId);
}

// export recipe (the CPU export renderer assembles from the same scenes; nothing is rendered now)
const recipe = { schema: 'transovo.assembly/1', format: { width: fmt.width, height: fmt.height, fps: fmt.fps }, compiledFrom: 'live layered scenes',
  segments: sceneDocs.map(s => ({ id: s.sceneId, source: { scene: s.sceneId }, frames: s.timeline.frames, startSec: s.timeline.startSec, endSec: s.timeline.endSec,
    filters: [{ f: 'fps', fps: fmt.fps }, { f: 'format', pix_fmts: 'yuv420p' }, { f: 'setsar', r: 1 }, { f: 'trim', end_frame: s.timeline.frames }, { f: 'setpts', expr: 'PTS-STARTPTS' }] })),
  audio: { asset: mixUp.assetId, silent: false, bitrate: '192k', shortest: true },
  encode: { codec: 'h264', profile: 'high', level: '4.2', crf: 18, preset: 'medium' }, totalFrames };
assertSchema('assembly-recipe', recipe);
const recipeId = (await store.uploadJson(recipe, { filename: 'assembly-recipe.json' })).assetId; needed.add(recipeId);

const PLACEHOLDER = 'PLACEHOLDER_PROJECT_ID';
const projectId = arg('--project-id') || (JOB_DIR && fs.existsSync(path.join(JOB_DIR, 'state/job.json')) ? (j => (j.job || j).projectId)(readJson(path.join(JOB_DIR, 'state/job.json'))) : null) || PLACEHOLDER;
const document = { schema: PROJECT_SCHEMA, projectId, version: 1, parentVersion: null, title: SPEC.title || 'Video', createdAt: nowIso(),
  createdBy: { mode: 'import', note: 'live delivery: editable layered scenes, no rendered clips or master' }, changes: [{ type: 'import', note: 'live delivery' }],
  delivery: { mode: 'live' },
  format: { width: fmt.width, height: fmt.height, fps: fmt.fps, durationSec: durationMs / 1000, durationMs }, theme, overrides: { schema: 'transovo.edit-patch/1', scenes: {} },
  fontRecords: fontRecs, scenes: sceneDocs,
  sources: { mix: mixUp.assetId, stems: Object.fromEntries(audioTracks.map(t => [t.id, t.items.map(i => i.src)])), captions: captionsId },
  runtimeLock: lockId,
  master: { recipe: recipeId, renderedInVersion: 0, origin: 'live_delivery', encode: recipe.encode },
  validation: { status: 'ok', issues: [] }, assetRefs: [] };
document.assetRefs = collectRefs(document); for (const x of document.assetRefs) needed.add(x);

const liveProject = { schema: 'transovo.live-project/1', projectId, version: 1, title: SPEC.title || 'Video',
  format: { width: fmt.width, height: fmt.height, fps: fmt.fps, durationMs, frames: totalFrames, background: SPEC.background || '#000000' },
  theme, overrides: { schema: 'transovo.edit-patch/1', scenes: {} }, fonts: fontsLive,
  tracks: [
    audioTracks.find(t => t.id === 'main_voice'),
    audioTracks.find(t => t.id === 'adlibs'),
    { id: 'main_visuals', label: 'Main Visuals', kind: 'visual', items: [...sceneItems, ...footageItems] },
    { id: 'text', label: 'Text', kind: 'text', ...(captionsId ? { captions: captionsId } : {}), items: textItems },
    audioTracks.find(t => t.id === 'other_audio'),
  ],
  export: { video: { codec: 'h264', profile: 'high', level: '4.2', pixFmt: 'yuv420p', crf: 16, preset: 'medium', movflags: '+faststart' },
    audio: { codec: 'aac', sampleRate: 48000, channels: 2, bitrate: '192k', targetLufs: -14, truePeakDb: -1.5 }, captions: { burnIn: false, sidecar: ['vtt', 'srt'] }, renderer: 'cpu' } };

const assets = [...needed].sort().map(id => { const r = store.rec.get(id); if (!r) throw new Error('store missing ' + id); return { id, sha256: r.sha256, kind: r.kind, mime: r.mime, bytes: r.bytes, filename: r.filename, role: r.meta?.role || null, file: path.relative(OUT, r.path) }; });
mkdirp(path.join(OUT, 'payload'));
writeJson(path.join(OUT, 'payload', 'live.json'), { durationMs, document, liveProject, assets, bundles });

// ---------- 1b. local live preview (final full watch; no render) ----------
// OUT/preview = the reference player (live_playback_handoff/sample) + materialized bundles + stems + captions.
// Serve with `node OUT/preview/serve.mjs` (PORT=…), open /, play the whole film with audio.
{
  const { materializeBundle } = await import('../lib/bundle.mjs');
  const PV = path.join(OUT, 'preview'); fs.rmSync(PV, { recursive: true, force: true });
  const PLAYER = process.env.MS_LIVE_PLAYER_DIR || '/workspace/live_playback_handoff/sample';
  for (const f of ['index.html', 'player.js', 'player.css', 'serve.mjs']) { mkdirp(PV); fs.copyFileSync(path.join(PLAYER, f), path.join(PV, f)); }
  const link = (src, dest) => { mkdirp(path.dirname(dest)); try { fs.linkSync(src, dest); } catch { fs.copyFileSync(src, dest); } };
  for (const b of bundles) await materializeBundle(store, b.bundleId, path.join(PV, 'scenes', b.sceneId), path.join(OUT, 'work', 'cache'));
  const local = JSON.parse(JSON.stringify(liveProject));
  for (const [k, v] of Object.entries(local.fonts)) { const rel = `scenes/_fonts/${k}.ttf`; link(store.rec.get(v.src).path, path.join(PV, rel)); v.src = rel; }
  for (const t of local.tracks) {
    if (t.kind === 'audio') for (const it of t.items) { const rel = `audio/${t.id}_${it.id}.${(store.rec.get(it.src).filename.split('.').pop() || 'wav')}`; link(store.rec.get(it.src).path, path.join(PV, rel)); it.src = rel; }
    if (t.captions) { const rel = 'captions/captions.json'; link(store.rec.get(t.captions).path, path.join(PV, rel)); t.captions = rel; }
    // the reference player treats every visual item as a scene; footage layers already play inside their scene
    if (t.kind === 'visual') { t.items = t.items.filter(it => it.type === 'scene'); for (const it of t.items) it.bundle = { base: `scenes/${it.sceneId}/`, entry: 'index.html', manifest: 'editable-elements.json' }; }
  }
  writeJson(path.join(PV, 'project.live.json'), local);
  log('live preview ready:', path.relative(process.cwd(), PV) || PV, '(node serve.mjs, then open / and play the whole film)');
}

// ---------- 2. validate (exact server rules, local) ----------
const issues = [], warns = [];
const ALLOWED_KIND = ['video', 'project', 'media', 'audio', 'source', 'font', 'image', 'bundle'];
const ALLOWED_MIME = ['video/mp4', 'video/webm', 'video/quicktime', 'application/json', 'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'audio/mpeg', 'audio/wav',
  'audio/x-wav', 'audio/mp4', 'text/plain', 'application/x-subrip', 'application/zip', 'font/ttf', 'font/otf', 'font/woff', 'font/woff2',
  'application/octet-stream', 'application/wasm', 'application/javascript', 'text/javascript', 'text/css'];
const wire = a => ({ ...a, mime: /^(text\/(html|x-python|x-shellscript|markdown|vtt))$/.test(a.mime) ? 'text/plain' : a.mime,
  kind: a.id.startsWith('bnd_') ? 'bundle' : a.id.startsWith('fnt_') ? 'font' : a.kind, filename: String(a.filename || a.id).slice(0, 150).replace(/[^a-zA-Z0-9._-]/g, '_') });
for (const a0 of assets) {
  const a = wire(a0);
  if (['master', 'scene_clip', 'editor_base'].includes(a0.role) || /^(master|editor-base)\.mp4$/i.test(a.filename)) issues.push('rendered output in a live package: ' + a.filename);
  if (!ALLOWED_KIND.includes(a.kind) || !ALLOWED_MIME.includes(a.mime)) issues.push(`upload would be refused (kind ${a.kind}, mime ${a.mime}): ${a.filename}`);
  if (a.mime === 'application/octet-stream' && (a.kind !== 'source' || a.bytes > 16 * 1024 * 1024 || !a.filename.endsWith('.frames'))) issues.push('octet-stream only for .frames packs <=16 MB: ' + a.filename);
  if (['font', 'image', 'bundle'].includes(a.kind) && a.bytes > 25 * 1024 * 1024) issues.push('font/image/bundle over 25 MB: ' + a.filename);
}
const schemaErr = check('project-version', document).filter(e => !/must have required property '(clip|asset)'/.test(e));
if (schemaErr.length) issues.push('producer document schema: ' + schemaErr.slice(0, 5).join('; '));

function buildManifest(storageOf) {
  const sid = id => { const s = storageOf.get(id); if (!s) throw new Error('no storage id for ' + id); return s; };
  const remap = v => JSON.parse(JSON.stringify(v, (k, x) => typeof x === 'string' && storageOf.has(x) ? storageOf.get(x) : x));
  const live = remap(liveProject);
  // fonts map keeps the producer font id as the key (theme faces reference it); only src is a storage id
  live.fonts = Object.fromEntries(Object.entries(liveProject.fonts).map(([k, v]) => [k, { ...v, src: sid(v.src) }]));
  return {
    format: 'motion-studio-portable/1', projectId,
    scenes: bundles.map(b => ({ id: b.sceneId, bundleAssetId: sid(b.bundleId), bundleSha256: b.sha256, engine: b.engine, runtime: b.runtime, manifest: b.manifest, dependencies: b.dependencies.map(sid) })),
    assets: assets.map(a => ({ id: sid(a.id), sha256: a.sha256, kind: wire(a).kind })),
    producerAssetMap: Object.fromEntries(assets.map(a => [a.id, sid(a.id)])),
    producerDocument: document,
    runtime: { nativeRuntimeLock: lockId },
    timeline: { nativeScenePlacements: sceneDocs.map(s => ({ sceneId: s.sceneId, timeline: s.timeline })) },
    audio: document.sources,
    liveProject: live,
  };
}
function checkManifest(manifest) {
  const out = [];
  let m; try { m = validatePortableManifest(manifest); } catch (e) { out.push('validatePortableManifest: ' + e.message); return { out }; }
  // botFinish(delivery:'live') checks
  const live = m.liveProject;
  if (live?.schema !== 'transovo.live-project/1' || Number(live.format?.durationMs) !== durationMs) out.push('complete would refuse: live schema/duration');
  const tl = normalizeUniversalTimeline(m);
  if (tl.durationMs !== durationMs) out.push(`player duration ${tl.durationMs} != ${durationMs}`);
  if (tl.visuals.filter(v => v.type === 'scene').length !== sceneDocs.length) out.push('player sees wrong scene count');
  const stemCount = audioTracks.reduce((n, t) => n + t.items.length, 0);
  if (tl.audio.length !== stemCount) out.push(`player sees ${tl.audio.length} audio items, expected ${stemCount}`);
  if (captionsId && tl.captionsAssetIds.length !== 1) out.push('caption track not visible to the player');
  if (tl.captions.length) out.push('inline caption items would double-draw with the caption file');
  return { out, tl, m };
}
// dry-run storage ids look like the server's upload ids (uuid)
const dryIds = new Map(assets.map(a => [a.id, [a.sha256.slice(0, 8), a.sha256.slice(8, 12), a.sha256.slice(12, 16), a.sha256.slice(16, 20), a.sha256.slice(20, 32)].join('-')]));
const dry = checkManifest(buildManifest(dryIds)); issues.push(...dry.out);
try { validateNativeProducerEnvelope(document); warns.push('native envelope unexpectedly accepted a document without master.asset'); }
catch (e) { warns.push('EXPORT GAP (server): ' + e.message + ' -> live document has no master.asset / scene clips; producer-render-job.ts + deterministic-results.ts need a live-aware envelope before Export works'); }
if (projectId === PLACEHOLDER) warns.push('projectId is a placeholder (dry run outside a live job)');
const mp4s = assets.filter(a => a.mime === 'video/mp4');
const totalBytes = assets.reduce((n, a) => n + a.bytes, 0);
const report = { ok: !issues.length, durationMs, frames: totalFrames, scenes: sceneDocs.length, assets: assets.length, totalMB: +(totalBytes / 1e6).toFixed(1),
  byKind: assets.reduce((o, a) => (o[wire(a).kind] = (o[wire(a).kind] || 0) + 1, o), {}),
  sourceFootageMp4s: mp4s.map(a => a.filename), renderedOutputs: 0,
  tracks: liveProject.tracks.map(t => `${t.id}:${t.items.length}`), captionCues: cueCount,
  player: dry.tl ? { durationMs: dry.tl.durationMs, visuals: dry.tl.visuals.length, audio: dry.tl.audio.length, captionAssets: dry.tl.captionsAssetIds.length } : null,
  issues, warnings: warns, contract: 'sms master 5dbe6b721' };
writeJson(path.join(OUT, 'payload', 'dry-run-report.json'), report);
log(JSON.stringify(report, null, 1));
if (issues.length) { log('FAIL'); process.exit(1); }
if (DRY) { log('PASS (dry run: no network calls made)'); process.exit(0); }

// ---------- 3. publish (live mode only) ----------
const secret = n => JOB_DIR && fs.existsSync(path.join(JOB_DIR, 'secrets', n)) ? fs.readFileSync(path.join(JOB_DIR, 'secrets', n), 'utf8').trim() : '';
const jobUrl = secret('job_url') || process.env.MOTION_STUDIO_JOB_URL || '';
const token = secret('token') || process.env.MOTION_STUDIO_JOB_TOKEN || '';
const endpoint = new URL(jobUrl);
if (endpoint.protocol !== 'https:' || !/(^|\.)transovo\.ai$/.test(endpoint.hostname) || !token) throw new Error('HTTPS transovo.ai job URL and job credential required');
if (projectId === PLACEHOLDER) throw new Error('--project-id (or --job-dir with state/job.json) required for a live publish');
const { uploadPrepared } = await import('./run-leased-render.mjs');
const { setTimeout: delay } = await import('node:timers/promises');
const { openAsBlob } = fs;
const api = async (suffix, body) => {
  const res = await fetch(endpoint.href.replace(/\/$/, '') + suffix, { method: body ? 'POST' : 'GET', redirect: 'error',
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) { let msg = ''; try { msg = String((await res.json()).error || '').slice(0, 200).replace(/https?:\/\/\S+/g, '[url]'); } catch {} throw Object.assign(new Error('Producer request failed (HTTP ' + res.status + ') ' + msg), { status: res.status }); }
  return res.json();
};
async function retry(action) {
  for (let attempt = 0; ; attempt++) {
    try { return await action(); } catch (error) {
      const status = error.status ?? Number(/HTTP (\d+)/.exec(error.message)?.[1]);
      if (attempt >= 3 || (status >= 400 && status < 500 && ![408, 429].includes(status))) throw error;
      await delay(300 * 2 ** attempt);
    }
  }
}
const key = a => JSON.stringify([a.sha256, a.kind, a.filename, a.bytes, a.mime]);
const receipts = new Map((await retry(() => api('/assets', { action: 'receipts' }))).receipts.filter(r => r.currentJob).map(r => [key(r), r.id]));
const storageOf = new Map(); let next = 0, done = 0, failure;
const report2 = () => api('/progress', { stage: 'delivering', message: 'Uploading editable files: ' + done + ' / ' + assets.length }).catch(() => {});
await report2();
const heartbeat = setInterval(() => api('/checkpoint').catch(() => {}), 60000);
try {
  await Promise.all(Array.from({ length: Math.min(8, assets.length) }, async () => {
    while (!failure && next < assets.length) {
      const a0 = assets[next++]; const a = wire(a0);
      try {
        let id = receipts.get(key(a));
        if (!id) id = await retry(async () => {
          const blob = await openAsBlob(path.join(OUT, a0.file), { type: a.mime });
          if (blob.size !== a.bytes) throw new Error('package file size changed: ' + a.filename);
          const prepared = await api('/assets', { action: 'prepare', resume: true, kind: a.kind, filename: a.filename, mime: a.mime, bytes: a.bytes, sha256: a.sha256 });
          if (!prepared.exists) {
            const parts = await uploadPrepared(prepared, blob, a.mime);
            const c = await retry(() => api('/assets', { action: 'commit', uploadId: prepared.uploadId, parts }));
            if (c.status !== 'ready') throw new Error('commit not confirmed: ' + a.filename);
          }
          return prepared.uploadId;
        });
        storageOf.set(a0.id, id); done++; if (done % 8 === 0 || done === assets.length) await report2();
      } catch (e) { failure = e; }
    }
  }));
  if (failure) throw failure;
  // confirm every file landed (ready, same sha256/bytes) before publishing
  const landed = new Map((await retry(() => api('/assets', { action: 'receipts' }))).receipts.filter(r => r.currentJob).map(r => [r.id, r]));
  const missing = assets.filter(a => { const r = landed.get(storageOf.get(a.id)); return !r || r.sha256 !== a.sha256 || r.bytes !== a.bytes; });
  if (missing.length) throw new Error('not confirmed as landed: ' + missing.map(a => a.filename).slice(0, 10).join(', '));
  log(`all ${assets.length} files confirmed ready`);
  const manifest = buildManifest(storageOf); const chk = checkManifest(manifest);
  if (chk.out.length) throw new Error('manifest failed validation after upload: ' + chk.out.join('; '));
  const version = await retry(() => api('/portable', { manifest, theme: document.theme, overrides: document.overrides }));
  const lp = version?.manifest?.liveProject;
  if (lp?.schema !== 'transovo.live-project/1' || lp?.format?.durationMs !== durationMs)
    throw new Error('server returned an earlier version for this job without this live timeline (publish is idempotent per job); do not complete');
  writeJson(path.join(OUT, 'payload', 'live-publish-receipt.json'), { portableVersionId: version.id, revision: version.revision, durationMs, assets: assets.length });
  log('published portable version', version.id);
  if (!flag('--no-complete')) {
    await retry(() => api('/complete', { delivery: 'live', portableVersionId: version.id, durationMs }));
    log('completed with delivery:live');
  }
} finally { clearInterval(heartbeat); }

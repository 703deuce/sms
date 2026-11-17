// Import the finished Keith Murray 2-min documentary into (simulated) Transovo storage as a portable project, version 1.
// Reads the production folder read-only. Everything is referenced by Transovo asset id afterwards; no local paths are stored.
//   node fixtures/keith/import.mjs --api http://127.0.0.1:8787/api/motion-studio
import fs from 'node:fs'; import path from 'node:path';
import { StoreClient } from '../../producer/lib/store-client.mjs';
import { buildBundle, uploadAsset } from '../../producer/lib/bundle.mjs';
import { scanFonts, publicRecord } from '../../producer/lib/fonts.mjs';
import { resolveScene, sceneRenderKey, masterRenderKey, collectRefs, themeBound, PROJECT_SCHEMA } from '../../producer/lib/package.mjs';
import { assertSchema } from '../../producer/lib/schemas.mjs';
import { readJson, writeJson, nowIso, run, walk, ffprobe } from '../../producer/lib/util.mjs';
import { runtimeLock } from '../../producer/lib/runtime-lock.mjs';
const arg = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, r) => (v.startsWith('--') && a.push([v.slice(2), r[i + 1]]), a), []));
const API = arg.api || 'http://127.0.0.1:8787/api/motion-studio'; const PID = arg.project || 'km_doc_2min';
const R = '/workspace/motion_tests/keith_murray_doc_2min'; const FX = path.dirname(new URL(import.meta.url).pathname);
const t0 = Date.now(); const log = (...a) => console.log(`[import ${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const j = await (await fetch(API + '/_sim/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: PID, mode: 'import', action: 'import_finished_film' }) })).json();
const store = new StoreClient({ apiBase: j.apiBase, jobToken: j.jobToken });
const up = async (rel, meta = {}) => (await uploadAsset(store, path.join(R, rel), meta)).assetId;
const upMany = async (dir, filt = () => true) => { const out = {}; for (const f of walk(path.join(R, dir), (x, d) => d || filt(x))) out[f] = await up(path.join(dir, f)); return out; };
// ---- fonts (engine-native records, exact files the scenes use) ----
const fontFiles = ['BigShouldersDisplay[wght].ttf', 'BigShouldersText[wght].ttf', 'Spectral-Regular.ttf', 'Spectral-SemiBold.ttf', 'Spectral-Italic.ttf', 'Spectral-ExtraLight.ttf'].map(f => path.join(R, 'assets/fonts', f));
const frecs = await scanFonts(fontFiles); for (const r of frecs) await store.uploadFile(r.path, { kind: 'font', mime: 'font/ttf', filename: path.basename(r.path), meta: { fontId: r.fontId } });
const fid = n => frecs.find(r => path.basename(r.path) === n).fontId;
const theme = { schema: 'transovo.motion-theme/1', themeId: 'thm_lexicon', origin: { designedBy: 'grokbot', concept: 'The Lexicon', designFile: 'scenes/theme.json' },
  colors: { background: { value: '#07170F', label: 'Background', designName: 'deep' }, primary: { value: '#0E2A22', label: 'Primary (page / surface)', designName: 'pine' }, secondary: { value: '#C8462C', label: 'Secondary (stamps, years)', designName: 'brick' }, accent: { value: '#D4F03C', label: 'Accent (highlights, lamp)', designName: 'lime' }, text: { value: '#EFE7D6', label: 'Text / paper', designName: 'bone' } },
  fonts: { display: { faces: [fid('BigShouldersDisplay[wght].ttf')], weight: 900, label: 'Big Shoulders Display 900' }, label: { faces: [fid('BigShouldersText[wght].ttf')], weight: 700, label: 'Big Shoulders Text 700' }, body: { faces: [fid('Spectral-Regular.ttf'), fid('Spectral-SemiBold.ttf'), fid('Spectral-Italic.ttf')], weight: 400, label: 'Spectral 400/600 + Italic' } },
  brand: { logo: null } };
assertSchema('theme', theme); log('fonts', frecs.length);
const lock = await runtimeLock(); const lockId = (await store.uploadJson(lock, { filename: 'runtime-lock.json' })).assetId;
// ---- scenes ----
const browserCaps = (editable) => ({ livePreview: editable ? 'live' : 'render_only', editable, themeAware: editable, fallback: { mode: editable ? 'poster_then_render' : 'rendered_clip' },
  requires: { chrome: lock.chrome, webgl: 'webgl1 (SwiftShader on workers)', fontEngine: 'browser', node: lock.node, ffmpeg: lock.ffmpeg }, deterministic: { level: 'visual', note: 'SwiftShader raster; run-to-run differences <= 1/255 on <0.01% of pixels' } });
const sceneDefs = [];
for (const sid of ['S01', 'S05']) {
  const b = await buildBundle(store, { dir: path.join(FX, sid), sceneId: sid, revision: 1, engine: 'browser', entry: 'index.html', manifest: 'editable-elements.json', exclude: ['km_bw.jpg'],
    capabilities: browserCaps(true), runtime: { chrome: lock.chrome, three: 'r187', gsap: '3.15.1', 'ms-props': '1' }, render: { adapter: 'browser-capture', alpha: false, encode: { codec: 'h264', profile: 'high', level: '4.2', crf: 16, preset: 'medium' } },
    createdBy: { mode: 'import', from: `production scenes/${sid} (parameterized)` } });
  sceneDefs.push({ sid, bundle: b, editable: true }); log('bundle', sid, b.bundleId);
}
for (const sid of ['S02', 'S03', 'S04', 'OV']) {
  const b = await buildBundle(store, { dir: path.join(R, 'scenes', sid), sceneId: sid, revision: 1, engine: 'browser', entry: 'index.html', manifest: null, exclude: ['out'],
    extraFiles: fs.existsSync(path.join(R, 'scenes', sid, 'lib/cues.json')) ? { 'lib/cues.json': path.join(R, 'versions/roger/cues.json'), 'lib/words.json': path.join(R, 'versions/roger/words.json') } : {},
    capabilities: { ...browserCaps(false), rerender: 'not_verified', note: 'original production source, not parameterized: no editable manifest; the delivered clip is reused unchanged. Source snapshot was taken after the later (unfinished) re-voice, so re-rendering it is not claimed to reproduce the delivered clip.' }, runtime: { chrome: lock.chrome },
    render: { adapter: 'browser-capture', alpha: sid === 'OV', segments: sid === 'OV' ? [[0, 30], [30, 60], [60, 90], [90, 125.31]] : null }, createdBy: { mode: 'import', from: `production scenes/${sid} (original source)` } });
  sceneDefs.push({ sid, bundle: b, editable: false }); log('bundle', sid, b.bundleId);
}
// ---- media: clips, extracted footage, raw footage, photos, cut-outs, audio, stems, sources ----
const RG = 'versions/roger'; const shots = readJson(path.join(R, RG, 'shots.json')); const tl = readJson(path.join(R, RG, 'timeline.json'));
const clips = {}; for (const sid of ['S01', 'S02', 'S03', 'S04', 'S05']) clips[sid] = await up(`${RG}/renders/${sid}/${sid}.mp4`, { role: 'scene_clip', sceneId: sid, origin: 'production (delivered cut)' });
const ov = []; for (let i = 0; i < 4; i++) ov.push(await up(`${RG}/renders/OV/ov_${i}.mov`, { role: 'overlay_clip', part: i, origin: 'production (delivered cut)' }));
const extracted = {}; for (const s of shots.filter(s => s[5] !== 'scene')) extracted[s[0]] = await up(`${RG}/shots/${s[0]}.mp4`, { role: 'extracted_footage', shot: s[0], source: s[3] });
const rawIds = [...new Set([...shots.filter(s => s[3]).map(s => s[3]), ...tl.audio.filter(a => a.src.startsWith('assets/footage')).map(a => path.basename(a.src, '.mp4'))])];
const raw = {}; for (const id of rawIds) raw[id] = await up(`assets/footage/${id}.mp4`, { role: 'raw_footage', sourceId: id }); log('footage', Object.keys(extracted).length, 'shots,', rawIds.length, 'raw');
const photos = await upMany('assets/photos'); const cutouts = await upMany('work/cut');
const sources = {
  timeline: await up(`${RG}/timeline.json`), shots: await up(`${RG}/shots.json`), cues: await up(`${RG}/cues.json`), designTheme: await up('scenes/theme.json'), faceCenters: await up('scenes/face_centers.json'),
  narration: { scriptLines: await up(`${RG}/audio/script_lines.json`), words: await up(`${RG}/words.json`), wordsRaw: await up(`${RG}/audio/words_raw.json`), ttsAlignment: await up(`${RG}/audio/tts_alignment.json`), ttsRaw: await up(`${RG}/audio/tts_raw.mp3`), buildAudio: await up(`${RG}/audio/build_audio.py`), voice: 'ElevenLabs Roger (eleven_flash_v2_5)' },
  mix: await up(`${RG}/audio/mix.wav`), mixRaw: await up(`${RG}/audio/mix_raw.wav`),
  unfinishedRevision: { note: 'production started a Brian re-voice (20:26 ET) and re-rendered scenes/shots, but never rebuilt the mix or the master; kept as source only', shots: await up('scenes/shots.json'), timeline: await up('scenes/timeline.json'), words: await up('audio/words.json'), voice: await upMany('audio/brian') },
  stems: { dialog: await up('stems/dialog_raw.wav'), footageAudio: await up('stems/footage_audio_raw.wav'), music: await up('stems/music_raw.wav', { role: 'music', note: 'music bed as mixed; licence/source per production log' }), narration: await up('stems/narration_raw.wav'), sfx: await up('stems/sfx_raw.wav') },
  captions: { interviewVtt: await up('work/int_-yFQexR9Ntk.en.vtt') }, transcripts: await upMany('work', f => /^tx_.*\.txt$|^int_lines\.txt$/.test(f)),
  productionScripts: { assemble: await up('work/assemble.py'), timeline: await up('work/timeline.py'), timelineBrian: await up('work/timeline_brian.py'), renderBrowser: await up('work/render_browser.sh'), whisper: await up('work/whisper.py'), retime: await up('work/retime_brian.py'), sceneTools: await upMany('scenes/_tools', f => !f.includes('node_modules')) },
  sharedSceneLib: await upMany('scenes/_lib'), pageScene: await upMany('scenes/page'), photos, cutouts, footage: { raw, extracted },
  qa: await upMany('qa', f => !f.startsWith('probe')),
};
log('sources uploaded');
// ---- declarative master recipe (compiled from work/assemble.py semantics) ----
const NF = Math.round(shots.at(-1)[2] * 30);
const recipe = { schema: 'transovo.assembly/1', format: { width: 1920, height: 1080, fps: 30 }, compiledFrom: 'work/assemble.py (same filter graph, declarative)',
  segments: shots.map(s => { const nf = Math.round(s[2] * 30) - Math.round(s[1] * 30) + (s[0] === 'SH15' ? 12 : 0);
    return { id: s[0], source: s[5] === 'scene' ? { scene: s[0] } : { asset: extracted[s[0]] }, frames: nf, startSec: s[1], endSec: s[2],
      filters: [{ f: 'fps', fps: 30 }, { f: 'format', pix_fmts: 'yuv420p' }, { f: 'setsar', r: 1 }, { f: 'tpad', stop_mode: 'clone', stop_duration: 1 }, { f: 'trim', end_frame: nf }, { f: 'setpts', expr: 'PTS-STARTPTS' }] }; }),
  groupFilters: [{ f: 'fps', fps: 30 }],
  transitions: [{ type: 'xfade', after: 'SH15', transition: 'fade', durationSec: 0.4, offsetSec: Math.round(shots.find(s => s[0] === 'SH15')[2] * 30) / 30 }],
  overlays: [{ id: 'OV', scene: 'OV', parts: 4, filters: [{ f: 'setpts', expr: 'PTS-STARTPTS' }], overlay: { x: 0, y: 0, format: 'auto', shortest: 0 } }],
  audio: { asset: sources.mix, bitrate: '128k', shortest: true },
  post: [{ f: 'noise', alls: 3, allf: 't' }, { f: 'fade', t: 'in', st: 0, d: 0.5, color: '$fadeColor' }, { f: 'fade', t: 'out', fromEnd: 0.8, d: 0.8, color: '$fadeColor' }, { f: 'trim', end_frame: NF }, { f: 'format', pix_fmts: 'yuv420p' }],
  totalFrames: NF,
  encode: { codec: 'h264', twoPass: true, bitrate: '1150k', maxrate: '2.2M', bufsize: '4M', preset: 'slow', tune: 'film', level: '4.2', note: 'production final used x264 auto level; re-assembly pins High@4.2 per delivery rule' },
  themeBindings: { fadeColor: 'colors.primary.value' } };
assertSchema('assembly-recipe', recipe); const recipeId = (await store.uploadJson(recipe, { filename: 'assembly-recipe.json' })).assetId;
const master = await up('final/keith_murray_doc_2min.mp4', { role: 'master', origin: 'production' });
// ---- posters (preview fallback) from the production clips ----
const posters = {}; fs.mkdirSync('/tmp/km_posters', { recursive: true });
for (const d of sceneDefs) { const holdF = d.bundle.manifest ? d.bundle.manifest.format.holdFrame : null; const src = d.sid === 'OV' ? null : path.join(R, `versions/roger/renders/${d.sid}/${d.sid}.mp4`); if (!src) continue;
  const out = `/tmp/km_posters/${d.sid}.jpg`; await run('ffmpeg', ['-y', '-v', 'error', '-i', src, '-vf', `select=eq(n\\,${holdF ?? 60})`, '-frames:v', '1', '-q:v', '3', out]); posters[d.sid] = (await uploadAsset(store, out, { role: 'poster', sceneId: d.sid })).assetId; }
// ---- the version document ----
const doc = { schema: PROJECT_SCHEMA, projectId: PID, version: 1, parentVersion: null, title: 'Keith Murray: 2-minute documentary', createdAt: nowIso(), createdBy: { mode: 'import', jobId: j.jobId, workerId: 'importer' },
  changes: [{ type: 'import', note: 'finished production imported; S01 + S05 parameterized (editable), other scenes reused as rendered clips' }],
  format: { width: 1920, height: 1080, fps: 30, durationSec: recipe.totalFrames / 30 }, theme, overrides: { schema: 'transovo.edit-patch/1', scenes: {} },
  fontRecords: frecs.map(r => { const p = publicRecord(r); delete p.path; return p; }), scenes: [], sources, runtimeLock: lockId, validation: {} };
const assetsMeta = {}; for (const id of [...new Set(sceneDefs.flatMap(d => d.bundle.doc.liveAssets))]) { const a = (await store.assetInfo(id)).asset; assetsMeta[id] = { mime: a.mime, width: a.meta.width, height: a.meta.height, meta: a.meta }; }
const issuesAll = [];
for (const s of shots.filter(s => s[5] === 'scene').map(s => s[0]).concat(['OV'])) { const d = sceneDefs.find(x => x.sid === s); const resolved = d.editable ? resolveScene(d.bundle.manifest, doc, { assets: assetsMeta }) : null;
  if (resolved) issuesAll.push(...resolved.issues);
  const sh = shots.find(x => x[0] === s);
  doc.scenes.push({ sceneId: s, bundle: d.bundle.bundleId, editable: d.editable, themeAware: d.editable, role: s === 'OV' ? 'overlay' : 'scene', timeline: sh ? { startSec: sh[1], endSec: sh[2], frames: Math.round(sh[2] * 30) - Math.round(sh[1] * 30) } : { startSec: 0, endSec: recipe.totalFrames / 30, frames: recipe.totalFrames },
    clip: s === 'OV' ? { asset: ov[0], parts: ov, renderKey: sceneRenderKey({ bundleId: d.bundle.bundleId, resolved: null, runtimeLock: lockId }), renderedInVersion: 1, origin: 'production' } : { asset: clips[s], renderKey: sceneRenderKey({ bundleId: d.bundle.bundleId, resolved, runtimeLock: lockId }), frames: (await ffprobe(path.join(R, `versions/roger/renders/${s}/${s}.mp4`))).streams[0].nb_frames * 1, renderedInVersion: 1, origin: 'production' },
    preview: posters[s] ? { poster: posters[s] } : null, narrationRefs: s === 'S01' ? ['L01'] : [] });
}
doc.master = { recipe: recipeId, asset: master, renderKey: masterRenderKey({ recipe: recipeId, segmentClips: doc.scenes.map(s => s.clip.asset), themeBound: themeBound(recipe, theme), runtimeLock: lockId }), renderedInVersion: 1, origin: 'production', encode: { note: 'production final (x264 2-pass 1150k)' } };
doc.validation = { status: issuesAll.some(i => i.severity === 'error') ? 'errors' : 'ok', issues: issuesAll };
doc.assetRefs = collectRefs(doc);
assertSchema('project-version', doc);
const r = await store.publishVersion(PID, 0, doc); log('published', JSON.stringify(r), 'assets', doc.assetRefs.length, 'issues', issuesAll.map(i => i.code).join(',') || 'none');
writeJson(path.join(FX, '../../out/keith_v1_summary.json'), { projectId: PID, version: 1, bundles: Object.fromEntries(sceneDefs.map(d => [d.sid, d.bundle.bundleId])), assetRefs: doc.assetRefs.length, issues: issuesAll });
await store.complete(j.jobId, { status: 'completed', projectVersion: 1 });

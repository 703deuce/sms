// render-job.mjs: the deterministic (no-AI) revision pipeline.
// input: project + base version + edit patch (+ asset ids) + output settings  ->  validated, dependency-analysed, rendered,
// re-assembled, published as version base+1. The base version is never modified; any validation error stops before publish.
import fs from 'node:fs'; import path from 'node:path';
import { merge, resolve } from '../runtime/ms-resolve.js';
import { check } from './schemas.mjs'; import { materializeBundle, uploadAsset } from './bundle.mjs';
import { sceneRenderKey, masterRenderKey, collectRefs, themeBound, fontMap } from './package.mjs';
import { analyze } from './deps.mjs'; import { assemble } from './assemble.mjs';
import { renderBrowser, openScene, stillBrowser } from './engines/browser.mjs'; import { renderPython } from './engines/python.mjs';
import { run, nowIso, mkdirp, readJson, writeJson, sha256File } from './util.mjs'; import { CFG } from './config.mjs';
const clone = o => JSON.parse(JSON.stringify(o));
export class JobRejected extends Error { constructor(issues, stage) { super('rejected: ' + issues.filter(i => i.severity === 'error').map(i => i.code).join(',')); this.issues = issues; this.stage = stage; } }
async function fontIndex(store, cacheDir) { const f = path.join(cacheDir, 'font-index.json'); if (fs.existsSync(f)) return readJson(f); try { const c = await store.getFontCatalog('index'); writeJson(f, c); return c; } catch { return { fonts: [] }; } }
function idsIn(o) { const ids = new Set(); JSON.stringify(o, (k, v) => { if (k === 'asset' && typeof v === 'string') ids.add(v); if (k === 'faces' && Array.isArray(v)) v.forEach(x => ids.add(x)); return v; }); return [...ids]; }
/** ctx: { store, jobId, input (transovo.motion-job/1), worker:{workerId}, cacheDir, workDir, emit(ev), progress(phase,p,msg) } */
export async function deterministicRender(ctx) {
  const { store, input, cacheDir, workDir, emit = async () => {}, progress = async () => {} } = ctx; const T = { renderMs: 0, assembleMs: 0 };
  const se = check('render-job', input); if (se.length) throw new JobRejected(se.map(m => ({ severity: 'error', code: 'SCHEMA', message: m })), 'input');
  if (input.mode !== 'deterministic_render') throw new JobRejected([{ severity: 'error', code: 'WRONG_MODE', message: 'deterministic pipeline only runs deterministic_render jobs' }], 'input');
  if (input.brief) throw new JobRejected([{ severity: 'error', code: 'AI_REQUIRED', message: 'a creative brief needs a creative_production job; deterministic jobs take property edits only' }], 'input');
  const edits = input.edits || { schema: 'transovo.edit-patch/1' }; const pe = check('edit-patch', edits); if (pe.length) throw new JobRejected(pe.map(m => ({ severity: 'error', code: 'SCHEMA', message: m })), 'input');
  await progress('load', 2, 'loading base version');
  const heads = await store.listVersions(input.projectId); const baseV = input.baseVersion ?? heads.head;
  const base = await store.getVersion(input.projectId, baseV);
  // ---- candidate document (in memory only until every check passes) ----
  const doc = clone(base); doc.version = baseV + 1; doc.parentVersion = baseV; doc.createdAt = nowIso(); doc.createdBy = { mode: 'deterministic_render', jobId: ctx.jobId, workerId: ctx.worker.workerId };
  if (edits.theme) doc.theme = merge(doc.theme, edits.theme);
  doc.overrides = merge(doc.overrides || { schema: 'transovo.edit-patch/1' }, { scenes: edits.scenes || {} }); doc.overrides.schema = 'transovo.edit-patch/1';
  const issues = [];
  for (const sid of Object.keys(edits.scenes || {})) { const sc = doc.scenes.find(s => s.sceneId === sid);
    if (!sc) issues.push({ severity: 'error', code: 'UNKNOWN_SCENE', scene: sid, message: `scene ${sid} is not in this project` });
    else if (!sc.editable) issues.push({ severity: 'error', code: 'NOT_EDITABLE', scene: sid, message: `${sid} has no editable manifest (original clip reused); changing it needs a creative_production job` }); }
  // fonts referenced by the candidate (exact faces from the storage font index)
  const fidx = await fontIndex(store, cacheDir); const known = fontMap(doc);
  for (const id of idsIn([doc.theme, doc.overrides]).filter(x => x.startsWith('fnt_'))) if (!known[id]) { const r = fidx.fonts.find(f => f.fontId === id); if (r) { doc.fontRecords.push(r); known[id] = r; } }
  // asset metadata for every asset the edits reference (missing assets -> ASSET_MISSING from the resolver)
  const assets = {}; for (const id of idsIn([doc.theme, doc.overrides]).filter(x => x.startsWith('ast_'))) { try { const a = (await store.assetInfo(id)).asset; assets[id] = { mime: a.mime, width: a.meta && a.meta.width, height: a.meta && a.meta.height, meta: a.meta }; } catch { } }
  // ---- per-scene: manifest, render_editable pre-steps, static validation ----
  const scenes = []; const bundles = {};
  for (const sc of doc.scenes) {
    const bdir = path.join(workDir, 'bundles', sc.bundle); const { doc: bdoc } = await materializeBundle(store, sc.bundle, bdir, cacheDir); bundles[sc.sceneId] = { dir: bdir, doc: bdoc };
    if (!sc.editable) { scenes.push({ sc, editable: false }); continue; }
    const man = readJson(path.join(bdir, bdoc.manifest));
    for (const id of bdoc.liveAssets || []) if (!assets[id]) { const a = (await store.assetInfo(id)).asset; assets[id] = { mime: a.mime, width: a.meta && a.meta.width, height: a.meta && a.meta.height, meta: a.meta }; }
    await renderEditablePreSteps({ store, man, doc, sc, assets, cacheDir, workDir, emit });
    const oldR = resolve(man, base.theme, base.overrides || {}, { mode: 'render', fonts: fontMap(base), assets });
    const newR = resolve(man, doc.theme, doc.overrides, { mode: 'render', fonts: known, assets });
    issues.push(...newR.issues);
    scenes.push({ sc, editable: true, man, oldR, newR });
  }
  await emit({ type: 'validation', stage: 'static', issues });
  if (issues.some(i => i.severity === 'error')) throw new JobRejected(issues, 'static');
  // ---- dependency analysis ----
  const lockId = doc.runtimeLock; const recipe = await store.fetchJson(doc.master.recipe, cacheDir);
  const keyed = scenes.map(s => ({ ...s, sceneId: s.sc.sceneId, themeAware: s.editable, oldKey: s.sc.clip.renderKey, newKey: s.editable ? sceneRenderKey({ bundleId: s.sc.bundle, resolved: s.newR, runtimeLock: lockId }) : s.sc.clip.renderKey, oldResolved: s.oldR, newResolved: s.newR }));
  const themeChanged = JSON.stringify(base.theme) !== JSON.stringify(doc.theme);
  const narration = Object.fromEntries(scenes.filter(s => s.editable).map(s => [s.sc.sceneId, s.man.elements.filter(e => Object.values(e.properties).some(p => p.spokenInNarration)).map(e => e.id)]));
  const dep = analyze({ scenes: keyed, recipe, oldBound: themeBound(recipe, base.theme), newBound: themeBound(recipe, doc.theme), themeChanged, narration });
  await emit({ type: 'stage', stage: 'dependencies', data: dep }); issues.push(...dep.warnings);
  const todo = keyed.filter(s => s.oldKey !== s.newKey);
  if (input.dryRun) return { dryRun: true, dependencies: dep, issues };
  // ---- layout validation in the real engine (all changed scenes first, so nothing renders if one fails) ----
  const hostFor = (s) => ({ theme: doc.theme, overrides: doc.overrides, fonts: known, assets, mode: 'render' });
  const assetPathsFor = async (s) => { const ids = new Set([...idsIn([doc.theme, doc.overrides]), ...(bundles[s.sceneId].doc.liveAssets || []), ...s.man.elements.flatMap(e => Object.values(e.properties).filter(p => p.type === 'image' && p.default && p.default.asset).map(p => p.default.asset))]);
    for (const sel of Object.values(s.newR.fonts)) (sel.faces || []).forEach(f => ids.add(f)); JSON.stringify(s.newR.elements, (k, v) => { if (k === 'faces') v.forEach(f => ids.add(f)); return v; });
    const out = {}; for (const id of ids) { if (!id) continue; const r = await store.fetchAsset(id.split('.')[0], cacheDir); out[id.split('.')[0]] = { path: r.path, mime: r.asset.mime }; } return out; };
  const checkpoint = await store.api('GET', `/agent/jobs/${ctx.jobId}/checkpoint`).catch(() => ({ revision: 0 })); let cpRev = checkpoint.revision || 0; const done = (checkpoint.checkpoint && checkpoint.checkpoint.done) || {};
  for (const s of todo) { const b = bundles[s.sceneId];
    if (b.doc.engine === 'python') { const m = await renderPython({ store, bundleDir: b.dir, bundleDoc: b.doc, resolved: s.newR, out: path.join(workDir, 'measure', s.sceneId + '.json'), workDir: path.join(workDir, 'py', s.sceneId + '_measure'), cacheDir, assetPathsFor: () => assetPathsFor(s), mode: 'measure' });
      issues.push(...(m.issues || []).map(i => ({ ...i, scene: s.sceneId }))); continue; }
    if (b.doc.engine !== 'browser') continue; await progress('validate', 8, 'layout validation ' + s.sceneId);
    const S = await openScene({ bundleDir: b.dir, entry: b.doc.entry, host: hostFor(s), assetPaths: await assetPathsFor(s) });
    try { const li = await S.page.evaluate(() => window.__scene.validate()); const extra = li.filter(i => !issues.some(j => j.code === i.code && j.element === i.element && j.scene === i.scene)).map(i => ({ ...i, scene: s.sceneId })); issues.push(...extra);
      if (S.errors.some(e => !e.startsWith('[console]'))) issues.push({ severity: 'error', code: 'SCENE_RUNTIME_ERROR', scene: s.sceneId, message: S.errors.join(' | ').slice(0, 400) }); } finally { await S.close(); } }
  await emit({ type: 'validation', stage: 'layout', issues });
  if (issues.some(i => i.severity === 'error')) throw new JobRejected(issues, 'layout');
  // ---- preview-only job (rendered-preview fallback for scenes without live preview): one still per changed scene, no publish ----
  if (input.output?.stillOnly) { const so = input.output.stillOnly; const stills = {};
    const targets = input.scenes ? keyed.filter(s => input.scenes.includes(s.sceneId) && s.editable) : todo;
    for (const s of targets) { const b = bundles[s.sceneId]; const fps = s.man.format.fps; const frame = so.frame ?? (so.t !== undefined ? Math.round(so.t * fps) : s.man.format.holdFrame ?? 0);
      const out = path.join(workDir, 'preview', `${s.sceneId}_f${frame}.png`); mkdirp(path.dirname(out)); const t1 = Date.now();
      if (b.doc.engine === 'browser') { const r = await stillBrowser({ bundleDir: b.dir, entry: b.doc.entry, host: hostFor(s), assetPaths: await assetPathsFor(s), t: frame / fps, out, width: doc.format.width, height: doc.format.height }); if (!r.ok) throw new Error('still failed ' + s.sceneId); }
      else if (b.doc.engine === 'python') { const r = await renderPython({ store, bundleDir: b.dir, bundleDoc: b.doc, resolved: s.newR, out, workDir: path.join(workDir, 'py', s.sceneId), cacheDir, assetPathsFor: () => assetPathsFor(s), mode: 'still', still: frame }); if (!r.ok) throw new JobRejected(r.issues, 'render'); }
      const up = await uploadAsset(store, out, { role: 'preview_still', sceneId: s.sceneId, frame, renderKey: s.newKey }); stills[s.sceneId] = { asset: up.assetId, frame, renderKey: s.newKey, ms: Date.now() - t1 };
      await emit({ type: 'artifact', artifact: { assetId: up.assetId, role: 'preview_still', sceneId: s.sceneId, sha256: up.sha256 } }); }
    return { previewOnly: true, stills, dependencies: dep, issues, version: null, timings: T };
  }
  // ---- render changed scenes ----
  let k = 0; const rendered = {};
  for (const s of todo) { k++; const b = bundles[s.sceneId]; const out = path.join(workDir, 'render', `${s.sceneId}_v${doc.version}.mp4`);
    if (done[s.sceneId] && done[s.sceneId].renderKey === s.newKey) { s.sc.clip = done[s.sceneId].clip; await emit({ type: 'log', message: `${s.sceneId}: resumed from checkpoint` }); continue; }
    await progress('render', 10 + Math.round(60 * (k - 1) / todo.length), `rendering ${s.sceneId}`);
    let rep;
    if (b.doc.engine === 'browser') rep = await renderBrowser({ bundleDir: b.dir, entry: b.doc.entry, host: hostFor(s), assetPaths: await assetPathsFor(s), out, width: doc.format.width, height: doc.format.height, alpha: !!b.doc.render.alpha,
      onProgress: f => progress('render', 10 + Math.round(60 * (k - 1 + f) / todo.length), `rendering ${s.sceneId}`).catch(() => {}) });
    else if (b.doc.engine === 'python') rep = await renderPython({ store, bundleDir: b.dir, bundleDoc: b.doc, resolved: s.newR, out, workDir: path.join(workDir, 'py', s.sceneId), cacheDir, assetPathsFor: () => assetPathsFor(s) });
    else throw new Error('engine cannot render: ' + b.doc.engine);
    if (!rep.ok) throw new JobRejected(rep.issues || [{ severity: 'error', code: 'RENDER_FAILED', scene: s.sceneId }], 'render');
    T.renderMs += rep.renderMs || 0;
    const up = await uploadAsset(store, out, { role: 'scene_clip', sceneId: s.sceneId, version: doc.version, renderKey: s.newKey });
    s.sc.clip = { asset: up.assetId, renderKey: s.newKey, frames: rep.frames, renderedInVersion: doc.version, origin: 'deterministic_render' };
    const poster = path.join(workDir, 'render', `${s.sceneId}_v${doc.version}_poster.jpg`); const hf = s.man ? s.man.format.holdFrame : 0;
    await run(CFG.ffmpeg, ['-y', '-v', 'error', '-i', out, '-vf', `select=eq(n\\,${hf})`, '-frames:v', '1', '-q:v', '3', poster]); s.sc.preview = { poster: (await uploadAsset(store, poster, { role: 'poster', sceneId: s.sceneId })).assetId };
    rendered[s.sceneId] = { out, report: { frames: rep.frames, renderMs: rep.renderMs, issues: rep.issues, describe: rep.describe } };
    await emit({ type: 'artifact', artifact: { assetId: up.assetId, role: 'scene_clip', sceneId: s.sceneId, sha256: up.sha256 } });
    done[s.sceneId] = { renderKey: s.newKey, clip: s.sc.clip }; await store.checkpoint(ctx.jobId, ++cpRev, { stage: 'scenes', done });
  }
  // ---- master re-assembly ----
  const newBound = themeBound(recipe, doc.theme); const mkey = masterRenderKey({ recipe: doc.master.recipe, segmentClips: doc.scenes.map(s => s.clip.parts?.length ? [s.clip.asset, ...s.clip.parts] : s.clip.asset), themeBound: newBound, runtimeLock: lockId });
  let masterOut = null;
  if (mkey !== doc.master.renderKey && input.output?.master !== false) {
    await progress('assemble', 75, 'master re-assembly');
    const inputs = { segments: {}, overlays: {}, audio: null };
    for (const seg of recipe.segments) inputs.segments[seg.id] = (await store.fetchAsset(seg.source.scene ? doc.scenes.find(s => s.sceneId === seg.source.scene).clip.asset : seg.source.asset, cacheDir)).path;
    for (const o of recipe.overlays || []) { const sc = doc.scenes.find(s => s.sceneId === o.scene); inputs.overlays[o.id] = []; for (const id of sc.clip.parts || [sc.clip.asset]) inputs.overlays[o.id].push((await store.fetchAsset(id, cacheDir)).path); }
    inputs.audio = (await store.fetchAsset(recipe.audio.asset, cacheDir)).path;
    masterOut = path.join(workDir, 'render', `master_v${doc.version}.mp4`); const a = await assemble(recipe, inputs, newBound, masterOut, { workDir: path.join(workDir, 'assemble') }); T.assembleMs = a.ms;
    const up = await uploadAsset(store, masterOut, { role: 'master', version: doc.version, renderKey: mkey });
    doc.master = { ...doc.master, asset: up.assetId, renderKey: mkey, renderedInVersion: doc.version, origin: 'deterministic_render', encode: recipe.encode };
    await emit({ type: 'artifact', artifact: { assetId: up.assetId, role: 'master', sha256: up.sha256 } });
  }
  // ---- publish version base+1 (write-once; 409 if someone else published first) ----
  doc.changes = [{ type: 'deterministic_edit', jobId: ctx.jobId, edits, dependencies: dep, rerendered: todo.map(s => s.sceneId), masterReassembled: !!masterOut }];
  doc.validation = { status: issues.some(i => i.severity === 'error') ? 'errors' : issues.some(i => i.severity === 'warning') ? 'warnings' : 'ok', issues };
  doc.assetRefs = collectRefs(doc);
  const ve = check('project-version', doc); if (ve.length) throw new Error('internal: candidate document invalid: ' + ve.slice(0, 3).join('; '));
  await progress('publish', 95, 'publishing version ' + doc.version);
  const pub = await store.publishVersion(input.projectId, baseV, doc);
  return { published: pub, version: doc.version, dependencies: dep, issues, rendered, masterOut, timings: T, doc };
}
// render_editable worker steps (deterministic, local, no AI services): portrait grade, face-based focal point
async function renderEditablePreSteps({ store, man, doc, sc, assets, cacheDir, workDir, emit }) {
  const eo = ((doc.overrides.scenes || {})[sc.sceneId] || {}).elements || {};
  for (const el of man.elements) for (const [pn, ps] of Object.entries(el.properties)) {
    if (ps.tier !== 'render_editable' || eo[el.id]?.[pn] === undefined) continue;
    const imgProp = Object.entries(el.properties).find(([, p]) => p.type === 'image'); if (!imgProp) continue;
    const cur = eo[el.id][imgProp[0]] || imgProp[1].default; const srcId = cur.derivedFrom || cur.asset;
    if (pn === 'grade') { const v = eo[el.id][pn]; if (v === 'none') { if (cur.derivedFrom) eo[el.id][imgProp[0]] = { asset: cur.derivedFrom }; continue; } if (cur.derivedFrom && cur.op === v) continue;
      const src = await store.fetchAsset(srcId, cacheDir); const out = path.join(workDir, 'derived', `${srcId}_${v}.jpg`); mkdirp(path.dirname(out));
      await run(CFG.python, [path.join(CFG.root, 'producer/py/grade_portrait.py'), src.path, out, v]); const up = await uploadAsset(store, out, { role: 'derived_image', derivedFrom: srcId, op: v });
      eo[el.id][imgProp[0]] = { asset: up.assetId, derivedFrom: srcId, op: v }; assets[up.assetId] = { mime: 'image/jpeg', width: up.meta.width, height: up.meta.height, meta: up.meta };
      await emit({ type: 'log', message: `${sc.sceneId}.${el.id}.grade=${v}: derived ${up.assetId} from ${srcId}` }); }
    if (pn === 'autoFocalPoint' && eo[el.id][pn] === true) { const src = await store.fetchAsset(cur.asset, cacheDir);
      const r = await run(CFG.cvPython === CFG.python && fs.existsSync('/workspace/motion_engines/mediapipe/venv/bin/python') ? '/workspace/motion_engines/mediapipe/venv/bin/python' : CFG.cvPython, [path.join(CFG.root, 'producer/py/face_focal.py'), src.path, process.env.MS_FACE_MODEL || '/workspace/motion_engines/mediapipe/models/blaze_face_short_range.tflite']);
      const fp = JSON.parse(r.out.trim().split('\n').pop()); if (fp.focalPoint) { eo[el.id].focalPoint = fp.focalPoint; await emit({ type: 'log', message: `${sc.sceneId}.${el.id}.autoFocalPoint -> ${JSON.stringify(fp.focalPoint)} (${fp.faces} face)` }); }
      else await emit({ type: 'warning', message: `${sc.sceneId}.${el.id}.autoFocalPoint: no face found, focal point unchanged` }); }
  }
}

// Stage 4: every validation rule, exercised through real deterministic jobs on the worker. Each invalid job must be rejected
// with the expected code, publish nothing, and leave the base version byte-identical.
import path from 'node:path'; import { simJob, workerA, storeFor, OUT } from './lib.mjs'; import { runJob } from '../producer/lib/worker.mjs';
import { uploadAsset } from '../producer/lib/bundle.mjs'; import { canon, sha256, writeJson } from '../producer/lib/util.mjs';
const A = p => path.join(path.dirname(new URL(import.meta.url).pathname), 'assets', p);
const ANTON = 'fnt_97aae409210d255fb3b92f18c8af2ed1', PLAYFAIR = ['fnt_7b756032127781da7f7cc4410ec3cac5', 'fnt_e32edc03421ea13490f7956d6386c10d'];
async function job(pid, input, cfg = workerA, mode = 'deterministic_render') { const j = await simJob(pid, mode, { schema: 'transovo.motion-job/1', mode, projectId: pid, ...input }, cfg.workerId);
  return runJob({ apiBase: j.apiBase, jobId: j.jobId, jobToken: j.jobToken, cfg }); }
export async function runValidation() {
  const out = []; const K = 'km_doc_2min', P = 'phil_30s'; const { store: ks } = await storeFor(K); const { store: ps } = await storeFor(P);
  const snap = async (s, pid) => { const h = (await s.listVersions(pid)).head; return { head: h, sha: sha256(canon(await s.getVersion(pid, h))) }; };
  const up = async f => (await uploadAsset(ks, A(f), { role: 'customer_upload' })).assetId;
  const tiny = await up('tiny.png'), wide = await up('wide.png'), unsafe = await up('logo_unsafe.svg'), safeSvg = await up('logo_mark.svg'), logoPng = await up('logo_mark.png');
  const v1 = await ks.getVersion(K, 1); const recipe = await ks.fetchJson(v1.master.recipe, workerA.cacheDir); const wav = recipe.audio.asset;
  const S01 = el => ({ scenes: { S01: { elements: el } } }); const E = x => ({ edits: { schema: 'transovo.edit-patch/1', ...x }, dryRun: true });
  const cases = [
    ['RANGE', K, E(S01({ title: { fontSize: 5000 } }))], ['TYPE', K, E(S01({ title: { fontSize: 'huge' } }))], ['ENUM', K, E(S01({ logo: { position: 'middle' } }))],
    ['PROTECTED_PROPERTY', K, E(S01({ title: { rotation: 12 } }))], ['UNSUPPORTED_PROPERTY', K, E(S01({ title: { blink: true } }))], ['AI_REQUIRED', K, E(S01({ title: { revealStyle: 'typewriter' } }))],
    ['UNKNOWN_ELEMENT', K, E(S01({ subtitle: { text: 'x' } }))], ['UNKNOWN_SCENE', K, E({ scenes: { S99: { elements: {} } } })], ['NOT_EDITABLE', K, E({ scenes: { S02: { elements: { title: { text: 'x' } } } } })],
    ['TEXT_LINES', K, E(S01({ title: { text: 'Keith\nMurray\nLive' } }))], ['TEXT_TOO_LONG', K, E(S01({ year: { text: '1993-1994' } }))], ['TEXT_EMPTY', K, E(S01({ title: { text: '' } }))],
    ['FONT_MISSING', K, E({ theme: { fonts: { display: { faces: ['fnt_00000000000000000000000000000000'], weight: 400 } } } })],
    ['FONT_ENGINE_UNSUPPORTED', K, E({ theme: { fonts: { display: { faces: ['fnt_faa5f3656a78b2e2d450d27fe8382c77.1'], weight: 700 } } } })],
    ['GLYPH_MISSING', K, E({ theme: { fonts: { body: { faces: PLAYFAIR, weight: 400 } } } })],
    ['ASSET_MISSING', K, E(S01({ portrait: { image: { asset: 'ast_00000000000000000000000000000000' } } }))], ['ASSET_FORMAT', K, E(S01({ portrait: { image: { asset: wav } } }))],
    ['IMAGE_TOO_SMALL', K, E(S01({ portrait: { image: { asset: tiny } } }))], ['SVG_UNSAFE', K, E(S01({ logo: { visible: true, image: { asset: unsafe } } }))],
    ['CONTRAST_LOW', K, E(S01({ title: { color: '#0B1F15' } }))], ['UNKNOWN_TOKEN', K, E({ scenes: { S01: { tokens: { 'colors.neon': '#00FF00' } } } })],
    ['SCHEMA', K, { edits: { schema: 'transovo.edit-patch/1', scenes: 'S01' }, dryRun: true }],
    ['AI_REQUIRED', K, { brief: 'make it more energetic', dryRun: true }, workerA, 'deterministic_render', 'brief in a deterministic job'],
    ['TEXT_OVERFLOW', K, { edits: { schema: 'transovo.edit-patch/1', ...S01({ location: { text: 'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW' } }) } }, workerA, 'deterministic_render', 'browser layout, three.js/DOM'],
    ['TEXT_OVERFLOW', P, { edits: { schema: 'transovo.edit-patch/1', scenes: { S04: { elements: { labelA: { title: 'ROOFTOP' } } } } } }, workerA, 'deterministic_render', 'browser layout, PixiJS texture text'],
    ['RANGE', P, { edits: { schema: 'transovo.edit-patch/1', scenes: { sh04: { elements: { shot: { zoomEnd: 2.5 } } } } }, dryRun: true }, workerA, 'deterministic_render', 'python scene'],
    ['MODE_NOT_SUPPORTED', K, { brief: 'new scene' }, { ...workerA, workerId: 'wrk_render_only', modes: ['deterministic_render'] }, 'creative_production'],
  ];
  const accepted = [ // warnings / infos: job is accepted (dry run), issue reported
    ['FONT_WEIGHT_UNAVAILABLE', K, E({ theme: { fonts: { display: { faces: [ANTON], weight: 900 } } } })],
    ['FONT_STYLE_UNAVAILABLE', K, E({ theme: { fonts: { body: { faces: ['fnt_bbe1e33dfabbfe69b97564724bf76391'], weight: 400 } } } })],
    ['AUTOFIT_APPLIED', K, { edits: { schema: 'transovo.edit-patch/1', ...S01({ location: { text: 'Central Islip, Long Island, N.Y.' } }) }, output: { stillOnly: {} } }, workerA, 'deterministic_render', 'layout check + still preview, nothing published'],
    ['IMAGE_CROPPED', K, E(S01({ portrait: { image: { asset: wide } } }))], ['NARRATION_MISMATCH', K, E(S01({ location: { text: 'Central Islip, New York' } }))],
    ['NOT_THEME_AWARE', K, E({ theme: { colors: { accent: { value: '#E8590C' } } } })], ['SVG_OK', K, E(S01({ logo: { visible: true, image: { asset: safeSvg } } }))], ['PNG_LOGO_OK', K, E(S01({ logo: { visible: true, image: { asset: logoPng } } }))],
    ['IMAGE_UPSCALED', P, { edits: { schema: 'transovo.edit-patch/1', scenes: { sh04: { elements: { shot: { framingY: 0.0, zoomEnd: 1.0, zoomStart: 1.0 } } } } } , dryRun: false, output: { stillOnly: { frame: 30 } } }, workerA, 'deterministic_render', 'python measure + still preview'],
  ];
  for (const [code, pid, input, cfg, mode, note] of cases) { const s = pid === K ? ks : ps; const b = await snap(s, pid); const r = await job(pid, input, cfg, mode); const a = await snap(s, pid);
    const codes = (r.summary.failures || []).flatMap(f => (f.issues || []).map(i => i.code)); const pass = r.status === 'rejected' && codes.includes(code) && a.head === b.head && a.sha === b.sha;
    out.push({ code, project: pid, note: note || null, expect: 'rejected', status: r.status, codes: [...new Set(codes)], baseUnchanged: a.head === b.head && a.sha === b.sha, pass, message: (r.summary.failures || []).flatMap(f => f.issues || []).find(i => i.code === code)?.message || (r.summary.failures || [])[0]?.message }); }
  for (const [code, pid, input, cfg, mode, note] of accepted) { const s = pid === K ? ks : ps; const b = await snap(s, pid); const r = await job(pid, input, cfg, mode); const a = await snap(s, pid);
    const iss = r.result?.issues || []; const codes = [...new Set(iss.map(i => i.code))]; const want = code.endsWith('_OK') ? !iss.some(i => i.severity === 'error') : codes.includes(code);
    out.push({ code, project: pid, note: note || null, expect: 'accepted+reported', status: r.status, codes, baseUnchanged: a.head === b.head && a.sha === b.sha, pass: r.status === 'completed' && want && a.head === b.head, stills: r.result?.stills || undefined, message: iss.find(i => i.code === code)?.message }); }
  // OVERLAP / OUT_OF_SAFE_AREA: the generic layout helpers (Keith S01's ranges cannot produce an overlap; checked directly)
  globalThis.location ??= { search: '' }; globalThis.window ??= {}; const core = await import('../producer/runtime/ms-props-core.js').catch(e => (console.error('core import', e.message), null));
  if (core) { const iss = core.overlaps({ a: { x: 0, y: 0, w: 100, h: 100 }, b: { x: 50, y: 50, w: 100, h: 100 }, c: { x: 300, y: 0, w: 10, h: 10 } }, [], []); core.safeArea({ a: { x: 0, y: 0, w: 100, h: 100 } }, { x: 96, y: 54, w: 1728, h: 972 }, iss);
    out.push({ code: 'OVERLAP+OUT_OF_SAFE_AREA', note: 'unit check of the shared layout helpers', expect: 'reported', codes: iss.map(i => i.code), pass: iss.some(i => i.code === 'OVERLAP') && iss.some(i => i.code === 'OUT_OF_SAFE_AREA') }); }
  // optimistic concurrency: publishing on a stale base is refused (409) and does not overwrite
  const doc = await ks.getVersion(K, 1); let conflict = null; try { await ks.publishVersion(K, 0, { ...doc, version: 1 }); } catch (e) { conflict = String(e.message).slice(0, 120); }
  out.push({ code: 'VERSION_CONFLICT', expect: 'rejected', status: conflict ? 'rejected' : 'accepted', pass: !!conflict && /409|conflict/i.test(conflict), message: conflict });
  writeJson(path.join(OUT, 'validation.json'), out); return out;
}
if (import.meta.url === `file://${process.argv[1]}`) { const r = await runValidation(); for (const x of r) console.log(`${x.pass ? 'PASS' : 'FAIL'} ${x.code.padEnd(24)} ${x.project || ''} ${x.status} [${(x.codes || []).join(',')}] ${String(x.message || '').slice(0, 110)}`); }

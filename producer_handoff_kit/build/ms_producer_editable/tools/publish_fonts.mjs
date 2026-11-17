// Publish the engine-native font index + per-engine catalogs to storage (all font files uploaded, content-addressed).
//   node tools/publish_fonts.mjs --api <apiBase>
import { scanFonts, listSystemFontFiles, catalogFor, ENGINES, publicRecord, ffmpegProbe } from '../producer/lib/fonts.mjs';
import { StoreClient } from '../producer/lib/store-client.mjs'; import { walk, nowIso } from '../producer/lib/util.mjs'; import { mimeOf } from '../producer/lib/util.mjs';
import path from 'node:path';
const ai = process.argv.indexOf('--api'); const api = ai > 0 ? process.argv[ai + 1] : 'http://127.0.0.1:8787/api/motion-studio';
const j = await (await fetch(api + '/_sim/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: '_fonts', mode: 'import', action: 'publish_font_index' }) })).json();
const store = new StoreClient({ apiBase: j.apiBase, jobToken: j.jobToken });
const extra = ['/workspace/motion_tests/keith_murray_doc_2min/assets/fonts', '/workspace/motion_tests/gunna_mixed_2min/scenes/S04_plea_cinematic/fonts'].flatMap(d => walk(d, (f, isDir) => isDir || /\.(ttf|otf|woff2?)$/i.test(f)).map(f => d + '/' + f));
const recs = await scanFonts([...new Set([...(await listSystemFontFiles()), ...extra])]);
const files = new Map(); for (const r of recs) files.set(r.assetId, r.path);
let n = 0; for (const [id, p] of files) { const u = await store.uploadFile(p, { kind: 'font', mime: mimeOf(p), filename: path.basename(p) }); if (u.assetId !== id) throw new Error('font id mismatch ' + p); n++; }
// real ffmpeg drawtext probe for project fonts (system fonts keep the FreeType inference, labelled as such)
for (const r of recs) if (extra.includes(r.path)) r.engines['ffmpeg-drawtext'] = await ffmpegProbe(r, '/tmp/ffprobe_fonts');
const pub = recs.map(r => { const p = publicRecord(r); delete p.path; return p; });
await store.putFontCatalog('index', { schema: 'transovo.font-index/1', generatedAt: nowIso(), engines: ENGINES, fonts: pub });
const counts = {}; for (const e of ENGINES) { const c = catalogFor(e, recs, 'publish_fonts'); c.count = c.fonts.length; counts[e] = c.count; await store.putFontCatalog(e, c); }
console.log(JSON.stringify({ uploadedFiles: n, records: recs.length, catalogs: counts, indexBytes: JSON.stringify(pub).length }));

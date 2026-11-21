import fs from 'node:fs'; import { scanFonts, listSystemFontFiles, catalogFor, ENGINES } from '../producer/lib/fonts.mjs';
import { walk, writeJson } from '../producer/lib/util.mjs';
const extra = ['/workspace/motion_tests/keith_murray_doc_2min/assets/fonts', '/workspace/motion_tests/gunna_mixed_2min/scenes/S04_plea_cinematic/fonts', '/workspace/editable_contract_poc/assets/fonts']
  .filter(d => fs.existsSync(d)).flatMap(d => walk(d, (f, isDir) => isDir || /\.(ttf|otf|woff2?)$/i.test(f)).map(f => d + '/' + f));
const files = [...new Set([...(await listSystemFontFiles()), ...extra])];
const t0 = Date.now(); const recs = await scanFonts(files);
console.log('files', files.length, 'records', recs.length, 'sec', (Date.now() - t0) / 1000);
for (const e of ENGINES) console.log(e, catalogFor(e, recs, 'scan').fonts.length);
writeJson('out/fontscan/records_summary.json', recs.map(r => ({ fontId: r.fontId, fullName: r.fullName, path: r.path, ok: Object.fromEntries(Object.entries(r.engines).map(([k, v]) => [k, v.ok])) })));

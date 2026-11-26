// re-assemble the v1 master from the package (production clips) through the declarative recipe; compare to the production final
import { storeFor, workerA, compare, OUT } from './lib.mjs'; import { assemble } from '../producer/lib/assemble.mjs'; import { themeBound } from '../producer/lib/package.mjs';
import { writeJson } from '../producer/lib/util.mjs'; import path from 'node:path';
const { store } = await storeFor('km_doc_2min'); const doc = await store.getVersion('km_doc_2min', 1); const C = workerA.cacheDir;
const recipe = await store.fetchJson(doc.master.recipe, C); const inputs = { segments: {}, overlays: {}, audio: (await store.fetchAsset(recipe.audio.asset, C)).path };
for (const seg of recipe.segments) inputs.segments[seg.id] = (await store.fetchAsset(seg.source.scene ? doc.scenes.find(s => s.sceneId === seg.source.scene).clip.asset : seg.source.asset, C)).path;
for (const o of recipe.overlays) inputs.overlays[o.id] = await Promise.all(doc.scenes.find(s => s.sceneId === o.scene).clip.parts.map(async id => (await store.fetchAsset(id, C)).path));
const out = path.join(OUT, 'km_master_v1_reassembled.mp4'); const t0 = Date.now();
await assemble(recipe, inputs, themeBound(recipe, doc.theme), out, { workDir: path.join(OUT, 'asm_v1') });
const orig = (await store.fetchAsset(doc.master.asset, C)).path; const cmp = await compare(out, orig);
writeJson(path.join(OUT, 'master_repro.json'), { out, ms: Date.now() - t0, vsProductionFinal: cmp }); console.log(JSON.stringify({ ms: Date.now() - t0, cmp }));

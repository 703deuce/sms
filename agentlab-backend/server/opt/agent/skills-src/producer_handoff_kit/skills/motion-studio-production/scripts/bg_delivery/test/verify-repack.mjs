// verify-repack.mjs <liveDir> <originalPreviewScenesDir>: materialize every repacked bundle with the producer's own
// materializeBundle (sha256-checked) and compare file-by-file with the scenes built from the original bundles.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const [LIVE, ORIG] = process.argv.slice(2);
const { materializeBundle } = await import('/workspace/ms_producer_editable/producer/lib/bundle.mjs');
const pkg = JSON.parse(fs.readFileSync(path.join(LIVE, 'payload/live.packed.json')));
const rec = new Map(pkg.assets.map(a => [a.id, a]));
const store = { fetchAsset: async id => ({ path: path.join(LIVE, rec.get(id).file), asset: rec.get(id) }), fetchJson: async id => JSON.parse(fs.readFileSync(path.join(LIVE, rec.get(id).file))) };
const out = fs.mkdtempSync('/tmp/repack-verify-'); let files = 0, diffs = 0;
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)).map(x => e.name + '/' + x) : [e.name]);
const h = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for (const b of pkg.bundles) {
  await materializeBundle(store, b.bundleId, path.join(out, b.sceneId), path.join(out, '_cache'));
  const a = walk(path.join(out, b.sceneId)).sort(), o = walk(path.join(ORIG, b.sceneId)).sort();
  if (JSON.stringify(a) !== JSON.stringify(o)) { diffs++; console.log(b.sceneId, 'file list differs', a.length, o.length); }
  for (const f of a) { files++; if (fs.existsSync(path.join(ORIG, b.sceneId, f)) && h(path.join(out, b.sceneId, f)) !== h(path.join(ORIG, b.sceneId, f))) { diffs++; console.log('DIFF', b.sceneId, f); } }
}
console.log(`materialized ${pkg.bundles.length} repacked scenes, ${files} files, ${diffs} differences vs the original scenes`);
fs.rmSync(out, { recursive: true, force: true }); process.exit(diffs ? 1 : 0);

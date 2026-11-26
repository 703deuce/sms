#!/usr/bin/env node
// repack-live.mjs: fewer, cache-friendly uploads for a LIVE package, with no backend change.
// Reads <live>/payload/live.json (from publish-live.mjs --dry-run) and writes <live>/payload/live.packed.json:
//   * every scene-bundle file (index.html, scene code, layers/editable JSON, runtime JS, plate frames, images)
//     is packed into byte-concatenated `.frames` packs ({asset, sha256, bytes, offset, packSha256} entries:
//     the exact form Transovo's scene-host.ts already slices for any file);
//   * runtime files shared by 2+ scenes go into ONE common pack; each scene gets its own pack(s);
//   * packs are capped at --max-pack-mb (default 6 MB) so they stay under scene-host's 8 MB per-asset cache
//     (16 MB packs are evicted after every read, so each later frame request re-downloads the whole pack);
//   * fonts, stems, mix, captions, recipe, runtime lock and manifest @asset media are untouched.
// Then rebuilds the bundle docs (new content ids), the producer document refs and the asset list, re-checks
// every packed file against its original sha256, and runs the server validators locally. Nothing is uploaded.
//   node repack-live.mjs --live-dir <job>/editable/live [--max-pack-mb 6]
import fs from 'node:fs'; import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
if (!process.execArgv.some(a => a.includes('strip-types'))) {
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', fileURLToPath(import.meta.url), ...process.argv.slice(2)], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
const { sha256Buf, readJson, writeJsonAtomic } = await import('./lib.mjs');
const { buildManifest, checkManifest, checkUploadRules, dryStorageIds } = await import('./manifest.mjs');
const LIB = process.env.MS_PRODUCER_LIB || '/workspace/ms_producer_editable/producer/lib';
const { canon } = await import(path.join(LIB, 'util.mjs'));
const { collectRefs } = await import(path.join(LIB, 'package.mjs'));
let assertSchema = null; try { ({ assertSchema } = await import(path.join(LIB, 'schemas.mjs'))); } catch {}

const argv = process.argv.slice(2); const arg = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const LIVE = path.resolve(arg('--live-dir') || ''); const MAX = Math.round(Number(arg('--max-pack-mb') || 6) * 1024 * 1024);
if (!arg('--live-dir') || !(MAX > 0) || MAX > 16 * 1024 * 1024) { console.error('usage: --live-dir DIR [--max-pack-mb 1..16]'); process.exit(2); }
const pkg = readJson(path.join(LIVE, 'payload/live.json'));
const recOf = new Map(pkg.assets.map(a => [a.id, a]));
const blobPath = id => { const r = recOf.get(id); if (!r) throw new Error('package has no asset ' + id); return path.join(LIVE, r.file); };
const blobCache = new Map(); const blob = id => { if (!blobCache.has(id)) blobCache.set(id, fs.readFileSync(blobPath(id))); return blobCache.get(id); };
const storeDir = path.join(LIVE, 'store/blobs'); fs.mkdirSync(storeDir, { recursive: true });
const newAssets = new Map();
const put = (buf, o) => { const sha = sha256Buf(buf); const dest = path.join(storeDir, sha); if (!fs.existsSync(dest)) fs.writeFileSync(dest, buf);
  const id = (o.kind === 'bundle' ? 'bnd_' : 'ast_') + sha.slice(0, 32);
  newAssets.set(id, { id, sha256: sha, kind: o.kind, mime: o.mime, bytes: buf.length, filename: o.filename, role: o.role || null, file: path.relative(LIVE, dest) }); return { id, sha }; };

// 1. read every bundle file's original bytes (from its own blob or a slice of an old pack) and verify it
const oldDocs = pkg.bundles.map(b => ({ b, doc: JSON.parse(blob(b.bundleId).toString('utf8')) }));
const filesOf = new Map(); const shaUse = new Map();
for (const { b, doc } of oldDocs) {
  const list = [];
  for (const [rel, f] of Object.entries(doc.files)) {
    let bytes = blob(f.asset);
    if (f.packSha256 !== undefined) bytes = bytes.subarray(f.offset, f.offset + f.bytes);
    if (sha256Buf(bytes) !== f.sha256) throw new Error(`file ${b.sceneId}/${rel} does not match its sha256`);
    list.push({ rel, bytes, sha256: f.sha256, orig: f });
    shaUse.set(f.sha256, (shaUse.get(f.sha256) || new Set()).add(b.sceneId));
  }
  filesOf.set(b.sceneId, list);
}
// 2. pack: shared files -> common pack(s); scene files -> scene pack(s); boot files first in each scene
const bootRank = rel => rel === 'index.html' ? 0 : /\.(js|mjs|css)$/.test(rel) ? 1 : /\.json$/.test(rel) ? 2 : 3;
const packed = new Map();   // sha256 -> entry {asset, packSha256, offset, bytes, sha256}
const keepAlone = new Set();
function packGroup(items, label) {
  let cur = [], size = 0; const flush = () => { if (!cur.length) return;
    let off = 0; const members = cur.map(it => { const m = { offset: off, bytes: it.bytes.length, sha256: it.sha256 }; off += it.bytes.length; return [it.sha256, m]; });
    const data = Buffer.concat(cur.map(it => it.bytes)); const { id, sha } = put(data, { kind: 'source', mime: 'application/octet-stream', filename: sha256Buf(data) + '.frames', role: 'pack:' + label });
    for (const [s, m] of members) packed.set(s, { asset: id, sha256: s, bytes: m.bytes, offset: m.offset, packSha256: sha });
    cur = []; size = 0; };
  for (const it of items) {
    if (packed.has(it.sha256) || cur.some(c => c.sha256 === it.sha256)) continue;
    if (it.bytes.length > MAX) { keepAlone.add(it.sha256); continue; }
    if (size + it.bytes.length > MAX) flush();
    cur.push(it); size += it.bytes.length;
  }
  flush();
}
const all = [...filesOf.values()].flat();
packGroup(all.filter(f => shaUse.get(f.sha256).size > 1).sort((a, b) => a.rel < b.rel ? -1 : 1), 'common');
for (const [sceneId, list] of filesOf) packGroup([...list].sort((a, b) => bootRank(a.rel) - bootRank(b.rel) || (a.rel < b.rel ? -1 : 1)), sceneId);

// 3. new bundle docs (same content, new file map) + new package
const remapBundle = new Map(); const bundles = [];
for (const { b, doc } of oldDocs) {
  const files = {};
  for (const f of filesOf.get(b.sceneId)) {
    if (keepAlone.has(f.sha256)) { const o = f.orig; files[f.rel] = o.packSha256 !== undefined ? (() => { throw new Error('file larger than --max-pack-mb that was already packed: ' + f.rel); })() : { asset: o.asset, sha256: o.sha256, bytes: o.bytes }; continue; }
    files[f.rel] = packed.get(f.sha256);
  }
  const nd = { ...doc, files }; if (assertSchema) assertSchema('scene-bundle', nd);
  const { id, sha } = put(Buffer.from(canon(nd)), { kind: 'bundle', mime: 'application/json', filename: `${b.sceneId}.bundle.json` });
  remapBundle.set(b.bundleId, id);
  bundles.push({ ...b, bundleId: id, sha256: sha, dependencies: [...new Set(Object.values(files).map(f => f.asset))] });
}
const document = JSON.parse(JSON.stringify(pkg.document));
for (const s of document.scenes) if (remapBundle.has(s.bundle)) s.bundle = remapBundle.get(s.bundle);
document.assetRefs = collectRefs({ ...document, assetRefs: [] });
// keep every asset still referenced outside the old bundle file maps; drop old bundles + files now inside packs
const stillRef = new Set([...collectRefs(document), ...collectRefs(pkg.liveProject), ...collectRefs(bundles.map(b => b.manifest)),
  ...bundles.flatMap(b => b.dependencies), ...bundles.map(b => b.bundleId)]);
for (const { doc } of oldDocs) for (const x of [...(doc.dependencies?.assets || []), ...(doc.liveAssets || [])]) stillRef.add(x);
const oldBundleFileAssets = new Set(oldDocs.flatMap(({ doc }) => Object.values(doc.files).map(f => f.asset)));
const kept = pkg.assets.filter(a => !remapBundle.has(a.id) && (!oldBundleFileAssets.has(a.id) || stillRef.has(a.id)));
const assets = [...kept, ...[...newAssets.values()].filter(a => stillRef.has(a.id))].sort((a, b) => a.id < b.id ? -1 : 1);
const out = { ...pkg, document, assets, bundles, packedFrom: { assets: pkg.assets.length, maxPackBytes: MAX } };

// 4. verify: every scene file materializes byte-identical from the new package; server validators pass
const recNew = new Map(assets.map(a => [a.id, a]));
for (const nb of bundles) {
  const doc = JSON.parse(fs.readFileSync(path.join(LIVE, recNew.get(nb.bundleId).file)));
  const before = Object.fromEntries(filesOf.get(nb.sceneId).map(f => [f.rel, f.sha256]));
  if (Object.keys(doc.files).length !== Object.keys(before).length) throw new Error('file count changed in ' + nb.sceneId);
  for (const [rel, f] of Object.entries(doc.files)) {
    const r = recNew.get(f.asset); if (!r) throw new Error('bundle references an asset not in the package: ' + rel);
    let bytes = fs.readFileSync(path.join(LIVE, r.file));
    if (f.packSha256 !== undefined) { if (sha256Buf(bytes) !== f.packSha256) throw new Error('pack sha mismatch'); bytes = bytes.subarray(f.offset, f.offset + f.bytes); }
    if (sha256Buf(bytes) !== before[rel] || f.sha256 !== before[rel]) throw new Error(`repacked ${nb.sceneId}/${rel} differs from the original`);
  }
}
const issues = [...checkUploadRules(out), ...checkManifest(out, buildManifest(out, dryStorageIds(out)))];
const manifestBytes = JSON.stringify(buildManifest(out, dryStorageIds(out))).length;
const report = { ok: !issues.length, assetsBefore: pkg.assets.length, assetsAfter: assets.length,
  packs: assets.filter(a => a.mime === 'application/octet-stream').map(a => ({ role: a.role, MB: +(a.bytes / 1e6).toFixed(2) })),
  largestPackMB: +(Math.max(0, ...assets.filter(a => a.mime === 'application/octet-stream').map(a => a.bytes)) / 1e6).toFixed(2),
  oldLargestPackMB: +(Math.max(0, ...pkg.assets.filter(a => a.mime === 'application/octet-stream').map(a => a.bytes)) / 1e6).toFixed(2),
  filesVerifiedIdentical: bundles.reduce((n, b) => n + filesOf.get(b.sceneId).length, 0), manifestBytes, issues };
if (issues.length) { console.log(JSON.stringify(report, null, 1)); console.log('FAIL'); process.exit(1); }
writeJsonAtomic(path.join(LIVE, 'payload/live.packed.json'), out);
writeJsonAtomic(path.join(LIVE, 'payload/repack-report.json'), report);
console.log(JSON.stringify(report, null, 1)); console.log('PASS: wrote payload/live.packed.json');

// portable.mjs: a project version as a self-contained directory (package.json manifest + blobs by sha256). Moving a project
// between stores (or to cold storage) needs nothing else: no local paths, every byte addressed by asset id + sha256.
import fs from 'node:fs'; import path from 'node:path'; import { mkdirp, writeJson, readJson, sha256File, mimeOf } from './util.mjs';
export async function exportPackage(store, pid, version, outDir) {
  const doc = await store.getVersion(pid, version); mkdirp(path.join(outDir, 'blobs')); const assets = {}; const todo = [...doc.assetRefs]; const seen = new Set();
  while (todo.length) { const id = todo.pop(); if (seen.has(id)) continue; seen.add(id); const r = await store.fetchAsset(id, path.join(outDir, '.cache'));
    const dest = path.join(outDir, 'blobs', r.asset.sha256); if (!fs.existsSync(dest)) { try { fs.linkSync(r.path, dest); } catch { fs.copyFileSync(r.path, dest); } }
    assets[id] = { sha256: r.asset.sha256, bytes: r.asset.bytes, mime: r.asset.mime, kind: r.asset.kind, filename: r.asset.filename, meta: r.asset.meta };
    if (id.startsWith('bnd_')) { const b = JSON.parse(fs.readFileSync(r.path, 'utf8')); for (const f of Object.values(b.files)) todo.push(f.asset); for (const x of (b.dependencies?.assets || [])) todo.push(x); } }
  fs.rmSync(path.join(outDir, '.cache'), { recursive: true, force: true });
  const pkg = { schema: 'transovo.motion-package/1', projectId: pid, version, exportedAt: new Date().toISOString(), document: doc, assets };
  writeJson(path.join(outDir, 'package.json'), pkg); return { dir: outDir, assets: Object.keys(assets).length, bytes: Object.values(assets).reduce((n, a) => n + a.bytes, 0) };
}
export async function importPackage(store, dir) { const pkg = readJson(path.join(dir, 'package.json')); let up = 0, reused = 0;
  for (const [id, a] of Object.entries(pkg.assets)) { const f = path.join(dir, 'blobs', a.sha256); if ((await sha256File(f)) !== a.sha256) throw new Error('package blob corrupt: ' + id);
    const kind = id.startsWith('fnt_') ? 'font' : id.startsWith('bnd_') ? 'bundle' : a.kind; const r = await store.uploadFile(f, { kind, mime: a.mime, filename: a.filename, meta: a.meta });
    if (r.assetId !== id) throw new Error(`asset id mismatch ${id} -> ${r.assetId}`); r.reused ? reused++ : up++; }
  const heads = await store.listVersions(pkg.projectId); const doc = { ...pkg.document, version: heads.head + 1, parentVersion: heads.head || null };
  const pub = await store.publishVersion(pkg.projectId, heads.head, doc); return { published: pub, uploaded: up, reused };
}

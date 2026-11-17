// bundle.mjs: immutable, versioned scene bundles. A bundle = canonical JSON doc listing every file by asset id + sha256,
// plus capabilities, runtime pins and the render adapter. bundleId = bnd_<sha256(canonical doc)[:32]> (content-addressed:
// a changed byte anywhere gives a new bundle id; an old bundle can never change).
import fs from 'node:fs'; import path from 'node:path';
import { canon, walk, mimeOf, mkdirp, sha256File } from './util.mjs';
import { CFG } from './config.mjs';
import { assertSchema } from './schemas.mjs';
export const RUNTIME_FILES = ['ms-props-core.js', 'ms-resolve.js', 'ms-bridge.js'];
const kindOf = f => /\.(mp4|mov|webm)$/i.test(f) ? 'video' : /\.(wav|mp3|m4a)$/i.test(f) ? 'audio' : /\.(png|jpe?g|webp|svg)$/i.test(f) ? 'image' : /\.(ttf|otf|woff2?)$/i.test(f) ? 'font' : 'source';
async function imageMeta(file) {
  if (/\.svg$/i.test(file)) { const s = fs.readFileSync(file, 'utf8'); const m = /viewBox="[\d.\s-]*?\s([\d.]+)\s+([\d.]+)"/.exec(s);
    const safe = !/<text[\s>]|<script|xlink:href="(?!#)|href="(?!#)|@import|url\((?!#)/i.test(s); return { width: m ? Math.round(+m[1]) : null, height: m ? Math.round(+m[2]) : null, svgSafe: safe }; }
  if (/\.(png|jpe?g|webp)$/i.test(file)) { const { run } = await import('./util.mjs'); const r = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', file]); const s = JSON.parse(r.out).streams[0]; return { width: s.width, height: s.height }; }
  return {};
}
export async function uploadAsset(store, file, extraMeta = {}) {
  const kind = kindOf(file); const meta = { ...(kind === 'image' ? await imageMeta(file) : {}), ...extraMeta };
  const r = await store.uploadFile(file, { kind, mime: mimeOf(file), meta }); return { ...r, kind, mime: mimeOf(file), meta };
}
/** build + upload a bundle.
 * opts: { dir, sceneId, revision, engine:'browser'|'python'|'clip', entry, manifest:'editable-elements.json'|null, exclude:[rel], extraFiles:{rel:abs},
 *         capabilities, runtime, render, dependencies:{assets:[]}, liveAssets:[], parentBundle, createdBy } */
export async function buildBundle(store, o) {
  const ex = f => (o.exclude || []).some(x => f === x || f.startsWith(x.endsWith('/') ? x : x + '/'));
  const rels = walk(o.dir, (f, isDir) => isDir ? !/(^|\/)(out|node_modules|\.git)\/$/.test(f) && !ex(f.slice(0, -1)) : !ex(f) && !/\.original\./.test(f));
  const src = Object.fromEntries(rels.map(r => [r, path.join(o.dir, r)]));
  if (o.engine === 'browser') for (const f of RUNTIME_FILES) src['ms/' + f] = path.join(CFG.root, 'producer/runtime', f);   // one runtime source of truth
  Object.assign(src, o.extraFiles || {});
  const files = {}; const tokens = {};
  // manifest: replace "@asset:<relpath>" tokens by real asset ids (uploaded first)
  let manifestDoc = null;
  if (o.manifest) { let txt = fs.readFileSync(src[o.manifest], 'utf8');
    for (const m of new Set([...txt.matchAll(/"@asset:([^"]+)"/g)].map(x => x[1]))) { const a = await uploadAsset(store, path.join(o.dir, m)); tokens[m] = a.assetId; txt = txt.split(`"@asset:${m}"`).join(`"${a.assetId}"`); }
    for (const [k, v] of Object.entries(o.vars || {})) txt = txt.split(`"@var:${k}"`).join(JSON.stringify(v));
    manifestDoc = assertSchema('editable-elements', JSON.parse(txt));
    const tmp = path.join(CFG.workDir, 'tmp', o.sceneId + '.editable-elements.json'); mkdirp(path.dirname(tmp)); fs.writeFileSync(tmp, JSON.stringify(manifestDoc, null, 1)); src[o.manifest] = tmp; }
  for (const [rel, abs] of Object.entries(src).sort()) { const r = await store.uploadFile(abs, { kind: kindOf(rel) === 'font' ? 'source' : kindOf(rel), mime: mimeOf(rel), filename: path.basename(rel) }); files[rel] = { asset: r.assetId, sha256: r.sha256, bytes: r.bytes }; }
  const doc = { schema: 'transovo.scene-bundle/1', sceneId: o.sceneId, revision: o.revision || 1, parentBundle: o.parentBundle || null, engine: o.engine, entry: o.entry || null, manifest: o.manifest || null,
    files, dependencies: o.dependencies || { assets: [] }, liveAssets: [...new Set([...(o.liveAssets || []), ...Object.values(tokens)])], capabilities: o.capabilities, runtime: o.runtime || {}, render: o.render, createdBy: o.createdBy || {} };
  assertSchema('scene-bundle', doc);
  const buf = Buffer.from(canon(doc)); const r = await store.uploadBuffer(buf, { kind: 'bundle', mime: 'application/json', filename: `${o.sceneId}.bundle.json` });
  return { bundleId: r.assetId, doc, manifest: manifestDoc, assetTokens: tokens };
}
// materialize a bundle into a fresh directory from storage only (no source paths). Every file sha256-verified.
export async function materializeBundle(store, bundleId, destDir, cacheDir) {
  const doc = await store.fetchJson(bundleId, cacheDir); mkdirp(destDir);
  for (const [rel, f] of Object.entries(doc.files)) { const { path: p } = await store.fetchAsset(f.asset, cacheDir); const d = path.join(destDir, rel); if (!d.startsWith(path.resolve(destDir) + path.sep)) throw new Error('path escape in bundle: ' + rel); mkdirp(path.dirname(d));
    if (!fs.existsSync(d) || (await sha256File(d)) !== f.sha256) { try { fs.rmSync(d, { force: true }); fs.linkSync(p, d); } catch { fs.copyFileSync(p, d); } } }
  return { dir: destDir, doc };
}

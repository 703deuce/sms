// bg_delivery/manifest.mjs: build + validate the live portable manifest from a live package
// (payload/live.json or live.packed.json written by publish-live.mjs / repack-live.mjs).
// Mirrors publish-live.mjs buildManifest/checkManifest; validators come from a read-only snapshot of
// 703deuce/sms master (contract/master-83a83d5c). Requires node --experimental-strip-types (bin wrappers re-exec).
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { SELF, wire } from './lib.mjs';

register(pathToFileURL(path.join(SELF, 'contract/ts-ext-loader.mjs')).href);
const CONTRACT = process.env.BG_DELIVERY_CONTRACT_DIR || path.join(SELF, 'contract/master-83a83d5c');
const { validatePortableManifest } = await import(pathToFileURL(path.join(CONTRACT, 'portable-contract.ts')).href);
const { normalizeUniversalTimeline } = await import(pathToFileURL(path.join(CONTRACT, 'universal-timeline.ts')).href);
export { validatePortableManifest };

export function buildManifest(pkg, storageOf) {
  const { document, liveProject, assets, bundles } = pkg; const projectId = document.projectId;
  const sid = id => { const s = storageOf.get(id); if (!s) throw new Error('no storage id for ' + id); return s; };
  const remap = v => JSON.parse(JSON.stringify(v, (k, x) => typeof x === 'string' && storageOf.has(x) ? storageOf.get(x) : x));
  const live = remap(liveProject);
  live.fonts = Object.fromEntries(Object.entries(liveProject.fonts || {}).map(([k, v]) => [k, { ...v, src: sid(v.src) }]));
  return {
    format: 'motion-studio-portable/1', projectId,
    scenes: bundles.map(b => ({ id: b.sceneId, bundleAssetId: sid(b.bundleId), bundleSha256: b.sha256, engine: b.engine, runtime: b.runtime, manifest: b.manifest, dependencies: b.dependencies.map(sid) })),
    assets: assets.map(a => ({ id: sid(a.id), sha256: a.sha256, kind: wire(a).kind })),
    producerAssetMap: Object.fromEntries(assets.map(a => [a.id, sid(a.id)])),
    producerDocument: document,
    runtime: { nativeRuntimeLock: document.runtimeLock },
    timeline: { nativeScenePlacements: document.scenes.map(s => ({ sceneId: s.sceneId, timeline: s.timeline })) },
    audio: document.sources,
    liveProject: live,
  };
}

export function checkManifest(pkg, manifest) {
  const out = []; const durationMs = pkg.durationMs;
  let m; try { m = validatePortableManifest(manifest); } catch (e) { out.push('validatePortableManifest: ' + e.message); return out; }
  const live = m.liveProject;
  if (live?.schema !== 'transovo.live-project/1' || Number(live.format?.durationMs) !== durationMs) out.push('complete would refuse: live schema/duration');
  const tl = normalizeUniversalTimeline(m);
  if (tl.durationMs !== durationMs) out.push(`player duration ${tl.durationMs} != ${durationMs}`);
  if (tl.visuals.filter(v => v.type === 'scene').length !== pkg.document.scenes.length) out.push('player sees wrong scene count');
  const stems = pkg.liveProject.tracks.filter(t => t?.kind === 'audio').reduce((n, t) => n + t.items.length, 0);
  if (tl.audio.length !== stems) out.push(`player sees ${tl.audio.length} audio items, expected ${stems}`);
  return out;
}

// upload rules from agent-bridge.ts botAssets prepare (origin/master 83a83d5c)
const KINDS = ['video', 'project', 'media', 'audio', 'source', 'font', 'image', 'bundle'];
const MIMES = ['video/mp4', 'video/webm', 'video/quicktime', 'application/json', 'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'audio/mpeg', 'audio/wav',
  'audio/x-wav', 'audio/mp4', 'text/plain', 'text/vtt', 'application/x-subrip', 'application/zip', 'font/ttf', 'font/otf', 'font/woff', 'font/woff2',
  'application/octet-stream', 'application/wasm', 'application/javascript', 'text/javascript', 'text/css'];
export function checkUploadRules(pkg) {
  const out = [];
  for (const a0 of pkg.assets) { const a = wire(a0);
    if (!KINDS.includes(a.kind) || !MIMES.includes(a.mime)) out.push(`upload would be refused (kind ${a.kind}, mime ${a.mime}): ${a.filename}`);
    if (a.mime === 'application/octet-stream' && (a.kind !== 'source' || a.bytes > 16 * 1024 * 1024 || !a.filename.endsWith('.frames'))) out.push('octet-stream only for .frames packs <=16 MB: ' + a.filename);
    if (['font', 'image', 'bundle'].includes(a.kind) && a.bytes > 25 * 1024 * 1024) out.push('font/image/bundle over 25 MB: ' + a.filename);
  }
  return out;
}

export function dryStorageIds(pkg) {
  return new Map(pkg.assets.map(a => [a.id, [a.sha256.slice(0, 8), a.sha256.slice(8, 12), a.sha256.slice(12, 16), a.sha256.slice(16, 20), a.sha256.slice(20, 32)].join('-')]));
}

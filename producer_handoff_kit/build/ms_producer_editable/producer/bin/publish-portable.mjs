#!/usr/bin/env node
// publish-portable.mjs: publish an editable payload (from build-editable-project.mjs) to an OPEN Transovo
// agent job: upload assets, POST /portable, then /complete. --dry-run validates only (adaptProducerProject +
// validatePortableManifest from the Transovo repo; set MS_ADAPTER to its producer-project-adapter.ts).
// Never logs tokens, signed URLs, or Authorization headers.
//   node producer/bin/publish-portable.mjs --dir OUT [--dry-run] [--no-complete]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { register } from 'node:module';

const SELF = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const dirArg = argv[argv.indexOf('--dir') + 1];
if (!argv.includes('--dir') || !dirArg) { console.error('usage: --dir OUT [--dry-run] [--no-complete]'); process.exit(2); }
const HERE = path.resolve(dirArg);
const ADAPTER = process.env.MS_ADAPTER || '/workspace/ms_producer_editable/transovo_contract/producer-project-adapter.ts';
const ALLOWED_MIME = new Set([
  'video/mp4', 'video/webm', 'video/quicktime', 'application/json', 'image/png',
  'image/jpeg', 'image/webp', 'image/svg+xml', 'audio/mpeg', 'audio/wav',
  'audio/x-wav', 'audio/mp4', 'text/plain', 'application/x-subrip', 'application/zip',
  'font/ttf', 'font/otf', 'font/woff', 'font/woff2',
  'application/wasm', 'application/javascript', 'text/javascript', 'text/css',
]);

if (!process.execArgv.some((a) => a.includes('strip-types'))) {
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', fileURLToPath(import.meta.url), ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
  process.exit(r.status ?? 1);
}
register(pathToFileURL(path.join(SELF, 'ts-ext-loader.mjs')).href);

const args = new Set(argv);
const dryRun = args.has('--dry-run');
const jobUrl = (process.env.JOB_URL || '').replace(/\/$/, '');
const jobToken = process.env.JOB_TOKEN || '';
const projectId = process.env.PROJECT_ID || '';

const redact = (s) => {
  let out = String(s);
  if (jobToken) out = out.split(jobToken).join('[redacted-token]');
  return out
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/https?:\/\/[^\s"']+/gi, '[url-redacted]')
    .replace(/[?&](X-Amz-[^=]+|Signature|access_token|token|jobToken)=[^&\s"]+/gi, '&$1=[redacted]');
};

const log = (...a) => console.log('[publish]', ...a.map((x) => typeof x === 'string' ? redact(x) : x));

function liveMime(filename, mime) {
  const ext = path.extname(filename || '').toLowerCase();
  if (ext === '.html' || mime === 'text/html') return 'text/plain';
  if (ext === '.py' || mime === 'text/x-python') return 'text/plain';
  if (ALLOWED_MIME.has(mime)) return mime;
  if (ext === '.js' || ext === '.mjs') return 'text/javascript';
  if (ext === '.css') return 'text/css';
  if (ext === '.json') return 'application/json';
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.ttf') return 'font/ttf';
  return 'text/plain';
}

function sha256Buf(buf) { return createHash('sha256').update(buf).digest('hex'); }

function loadPayload() {
  const raw = JSON.parse(fs.readFileSync(path.join(HERE, 'payload/publish.json'), 'utf8'));
  const pid = projectId || raw.placeholderProjectId || 'PLACEHOLDER_PROJECT_ID';
  const document = JSON.parse(JSON.stringify(raw.document));
  document.projectId = pid;
  const assets = raw.assets.map((a) => ({
    id: a.id,
    sha256: a.sha256,
    kind: a.kind,
    storageId: a.storageId || a.id,
    mime: a.mime,
    bytes: a.bytes,
    filename: a.filename,
    file: a.file,
  }));
  const bundles = JSON.parse(JSON.stringify(raw.bundles));
  return { raw, document, assets, bundles, pid };
}

function adapterInput(payload) {
  return {
    document: payload.document,
    assets: payload.assets.map((a) => ({ id: a.id, sha256: a.sha256, kind: a.kind, storageId: a.storageId || a.id })),
    bundles: payload.bundles,
  };
}

async function validate(payload) {
  const { adaptProducerProject } = await import(pathToFileURL(ADAPTER).href);
  const manifest = adaptProducerProject(adapterInput(payload));
  for (const sc of manifest.scenes) {
    if (sc.engine === 'browser' && sc.runtime !== 'chrome') throw new Error(sc.id + ' runtime is ' + sc.runtime + ', expected chrome');
    if (!sc.manifest.motionTree) throw new Error(sc.id + ' has no motionTree: every scene must publish editable layers');
    if (!sc.manifest.elements.some((e) => Object.values(e.properties || {}).some((p) => p.tier === 'render_editable')))
      throw new Error(sc.id + ' exposes no editable layer properties');
  }
  if (manifest.projectId !== payload.pid) throw new Error('projectId mismatch');
  return manifest;
}

if (dryRun) {
  const payload = loadPayload();
  const manifest = await validate(payload);
  const kinds = {};
  for (const a of manifest.assets) kinds[a.kind] = (kinds[a.kind] || 0) + 1;
  log('dry-run PASS',
    `projectId=${manifest.projectId}`,
    `scenes=${manifest.scenes.length}`,
    `engine=${manifest.scenes[0].engine}`,
    `runtime=${manifest.scenes[0].runtime}`,
    `assets=${manifest.assets.length}`,
    `kinds=${JSON.stringify(kinds)}`,
    `layers=${manifest.scenes.map((s) => s.id + ':' + (s.manifest.motionTree.nodes.length - 1)).join(',')}`,
    `producerDocument=${manifest.producerDocument?.schema}`);
  process.exit(0);
}

if (!jobUrl || !jobToken || !projectId) {
  console.error('[publish] live mode needs env JOB_URL, JOB_TOKEN, and PROJECT_ID (or use --dry-run)');
  process.exit(2);
}

async function api(method, suffix, body) {
  const url = jobUrl + suffix;
  const r = await fetch(url, {
    method,
    headers: { Authorization: 'Bearer ' + jobToken, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  if (!r.ok) throw new Error(`${method} ${suffix} -> ${r.status} ${redact(JSON.stringify(json)).slice(0, 400)}`);
  return json;
}

const payload = loadPayload();
await validate(payload);
// The server attaches the FIRST ready kind:"video" MP4 as the job result: upload the master first.
payload.assets.sort((x, y) => (y.id === payload.document.master.asset) - (x.id === payload.document.master.asset));
log('validated local payload; uploading', payload.assets.length, 'assets');

await api('POST', '/progress', { stage: 'delivering', percent: 90, message: 'Uploading your editable video' }).catch((e) => log('progress skipped', String(e.message || e)));

for (const a of payload.assets) {
  const abs = path.join(HERE, a.file);
  const buf = fs.readFileSync(abs);
  const sha = sha256Buf(buf);
  if (sha !== a.sha256) throw new Error('local sha mismatch for ' + a.id);
  const filename = String(a.filename || a.id).replace(/[^a-zA-Z0-9._-]/g, '_');
  const mime = liveMime(filename, a.mime);
  const prep = await api('POST', '/assets', {
    action: 'prepare', filename, kind: a.kind, mime, bytes: buf.length, sha256: sha,
  });
  let parts;
  if (prep.signedPut?.url) {
    const put = await fetch(prep.signedPut.url, { method: 'PUT', body: buf, headers: { 'Content-Type': mime, 'Content-Length': String(buf.length) } });
    if (!put.ok) throw new Error('upload PUT failed ' + put.status + ' for ' + a.id);
  } else if (prep.s3Multipart) {
    const { partSize, partUrls } = prep.s3Multipart;
    if (partUrls.length !== Math.ceil(buf.length / partSize)) throw new Error('invalid part count for ' + a.id);
    parts = [];
    for (const { partNumber, url } of partUrls) {
      const from = (partNumber - 1) * partSize;
      const r = await fetch(url, { method: 'PUT', body: buf.subarray(from, from + partSize) });
      if (!r.ok) throw new Error('part PUT failed ' + r.status + ' for ' + a.id);
      const etag = r.headers.get('etag');
      if (!etag) throw new Error('missing part etag for ' + a.id);
      parts.push({ partNumber, etag });
    }
  } else if (!prep.exists) {
    throw new Error('prepare returned no signedPut for ' + a.id);
  }
  const commit = await api('POST', '/assets', { action: 'commit', uploadId: prep.uploadId || prep.assetId, ...(parts ? { parts } : {}) });
  a.storageId = commit.uploadId || prep.uploadId;
  if (!a.storageId) throw new Error('no storageId after commit for ' + a.id);
  log('committed', a.kind, a.id, 'bytes', String(a.bytes));
}

await api('POST', '/progress', { stage: 'delivering', percent: 96, message: 'Publishing your editable video' }).catch(() => {});

const portableBody = {
  document: payload.document,
  assets: payload.assets.map((a) => ({ id: a.id, sha256: a.sha256, kind: a.kind, storageId: a.storageId })),
  bundles: payload.bundles,
};
const published = await api('POST', '/portable', portableBody);
log('portable published', `revision=${published.revision ?? published.version?.revision ?? 'ok'}`, `id=${published.id || published.version?.id || 'ok'}`);

if (!argv.includes('--no-complete')) {
  const durationMs = Number(payload.raw.durationMs);
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0) throw new Error('payload durationMs missing');
  await api('POST', '/complete', { durationMs });
  log('complete durationMs=' + durationMs);
}

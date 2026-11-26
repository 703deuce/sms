#!/usr/bin/env node
// stage-approved.mjs: turn a build-editable-project.mjs output (OUT/payload/publish.json + OUT/store/blobs)
// into the durable approved package that publish-editable.mjs consumes:
//   $MOTION_STUDIO_JOB_DIR/approved/{package.json, bundles.json, blobs/<sha256>}
// Writes to approved.staging first, verifies every blob's size + sha256, then renames to approved.
// No network. Never logs tokens or URLs.
//   node producer/bin/stage-approved.mjs --dir OUT --project-id PROJECT_ID [--job-dir DIR] [--editor-base CLEAN.mp4]
// --editor-base adds the clean, text-free cut as a registered video named editor-base.mp4 (editor canvas);
// the reviewed composite stays the master (playback and download).
import fs from 'node:fs'; import path from 'node:path'; import { createHash } from 'node:crypto';
const argv = process.argv.slice(2); const opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const OUT = path.resolve(opt('--dir') || ''); const pid = opt('--project-id') || process.env.PROJECT_ID;
const jobDir = path.resolve(opt('--job-dir') || process.env.MOTION_STUDIO_JOB_DIR || '');
if (!opt('--dir') || !pid || !(opt('--job-dir') || process.env.MOTION_STUDIO_JOB_DIR)) { console.error('usage: --dir OUT --project-id ID [--job-dir DIR] (or MOTION_STUDIO_JOB_DIR)'); process.exit(2); }
const approved = path.join(jobDir, 'approved'), staging = approved + '.staging';
if (fs.existsSync(path.join(approved, 'package.json')) && fs.existsSync(path.join(approved, 'bundles.json'))) { console.log('approved package already exists; resume publication from it'); process.exit(0); }
const raw = JSON.parse(fs.readFileSync(path.join(OUT, 'payload/publish.json'), 'utf8'));
const document = { ...raw.document, projectId: pid };
fs.rmSync(staging, { recursive: true, force: true }); fs.mkdirSync(path.join(staging, 'blobs'), { recursive: true, mode: 0o700 });
const assets = {}; let bytes = 0;
for (const a of raw.assets) {
  const src = path.resolve(OUT, a.file); const data = fs.readFileSync(src);
  if (data.length !== a.bytes || createHash('sha256').update(data).digest('hex') !== a.sha256) throw new Error('asset changed since build: ' + a.id);
  const dest = path.join(staging, 'blobs', a.sha256); if (!fs.existsSync(dest)) { try { fs.linkSync(src, dest); } catch { fs.copyFileSync(src, dest); } }
  assets[a.id] = { sha256: a.sha256, bytes: a.bytes, mime: a.mime, kind: a.kind, filename: a.filename }; bytes += a.bytes;
}
if (!assets[document.master?.asset]) throw new Error('approved package has no master asset');
const eb = opt('--editor-base');
if (eb) { const data = fs.readFileSync(path.resolve(eb)); const sha = createHash('sha256').update(data).digest('hex');
  if (!/\.mp4$/i.test(eb)) throw new Error('--editor-base must be an MP4');
  fs.writeFileSync(path.join(staging, 'blobs', sha), data);
  assets['ast_' + sha.slice(0, 32)] = { sha256: sha, bytes: data.length, mime: 'video/mp4', kind: 'video', filename: 'editor-base.mp4' }; bytes += data.length; }
fs.writeFileSync(path.join(staging, 'package.json'), JSON.stringify({ schema: 'transovo.motion-package/1', projectId: pid, durationMs: raw.durationMs, document, assets }));
fs.writeFileSync(path.join(staging, 'bundles.json'), JSON.stringify(raw.bundles));
fs.rmSync(approved, { recursive: true, force: true }); fs.renameSync(staging, approved);
console.log(`approved package ready: ${Object.keys(assets).length} assets, ${(bytes / 1e6).toFixed(1)} MB`);

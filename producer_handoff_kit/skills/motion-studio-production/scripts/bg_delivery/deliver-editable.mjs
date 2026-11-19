#!/usr/bin/env node
// deliver-editable.mjs (background worker, step 2): upload the editable LIVE package with no agent involvement,
// then POST /portable and POST /complete {delivery:"live", portableVersionId, durationMs}.
// Driven by <J>/deliver_bg/config.json (written by launch.sh). Run by watchdog.sh, never by hand in a turn.
//  * per-file retries with exponential backoff + jitter until the retry window ends (config.retryWindowHours, default 8)
//  * resume file <J>/deliver_bg/state.json (committed storage ids, portable version id) + server receipts
//  * keeps the job lease alive: GET /checkpoint every 60 s, also while backing off
//  * progress posts "Preparing your editable version: n / total"
//  * terminal: <J>/deliver_bg/DONE, or <J>/deliver_bg/FAILED + status.json + a final progress note
// Exit codes: 0 done, 3 failed for good (watchdog stops), anything else = crash (watchdog restarts).
import fs from 'node:fs'; import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
if (!process.execArgv.some(a => a.includes('strip-types'))) {
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', fileURLToPath(import.meta.url), ...process.argv.slice(2)], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
const { loadCreds, makeApi, makeLogger, retryUntil, uploadOne, sha256Buf, readJson, writeJsonAtomic, receiptKey, wire, transient } = await import('./lib.mjs');
const { buildManifest, checkManifest } = await import('./manifest.mjs');
const argv = process.argv.slice(2); const J = path.resolve(argv[argv.indexOf('--job-dir') + 1] || '');
if (!argv.includes('--job-dir')) { console.error('usage: --job-dir J'); process.exit(2); }
const BG = path.join(J, 'deliver_bg'); const cfg = readJson(path.join(BG, 'config.json'));
const log = makeLogger(path.join(BG, 'worker.log'), 'editable');
const stateFile = path.join(BG, 'state.json'); const state = fs.existsSync(stateFile) ? readJson(stateFile) : {};
const save = () => writeJsonAtomic(stateFile, state);
const status = (s, extra = {}) => writeJsonAtomic(path.join(BG, 'status.json'), { state: s, at: new Date().toISOString(), pid: process.pid, ...extra });
if (fs.existsSync(path.join(BG, 'DONE'))) { log('already DONE'); process.exit(0); }
if (fs.existsSync(path.join(BG, 'FAILED'))) { log('FAILED marker present; remove it to retry'); process.exit(3); }
{ // never two workers for one job (e.g. an orphan left by a killed watchdog)
  const pf = path.join(BG, 'worker.pid'); const old = fs.existsSync(pf) ? Number(fs.readFileSync(pf, 'utf8')) : 0;
  let cmd = ''; try { cmd = fs.readFileSync(`/proc/${old}/cmdline`, 'utf8'); } catch {}
  if (old && old !== process.pid && cmd.includes('deliver-editable.mjs') && cmd.includes(J)) { log(`another worker (pid ${old}) is still running; exiting`); process.exit(75); }
  fs.writeFileSync(pf, String(process.pid));
}

const LIVE = path.resolve(cfg.liveDir); const pkg = readJson(path.resolve(cfg.packageFile));
const durationMs = Number(cfg.durationMs ?? pkg.durationMs);
// retry window is measured from the FIRST worker start, so restarts don't extend it forever
state.windowStartedAt ||= new Date().toISOString(); save();
const deadline = Date.parse(state.windowStartedAt) + Number(cfg.retryWindowHours ?? 8) * 3600e3;
const CONC = Math.max(1, Math.min(8, Number(cfg.concurrency || 8)));

let api, heartbeat;
async function finalFail(reason, err) {
  const msg = `${reason}${err ? ': ' + String(err.message || err).slice(0, 300) : ''}`;
  log('FAILED ' + msg); status('FAILED', { reason, error: err ? String(err.message || err).slice(0, 300) : null, uploaded: Object.keys(state.storage || {}).length, total: pkg.assets.length });
  fs.writeFileSync(path.join(BG, 'FAILED'), `${new Date().toISOString()} ${msg}\nFix the cause, delete this file, then run: bash ${path.join(path.dirname(fileURLToPath(import.meta.url)), 'resume-all.sh')}\n`);
  if (api) await api('/progress', { stage: 'delivering', message: 'Your video is ready to watch. The editable version is delayed; our team has been notified.' }).catch(() => {});
  clearInterval(heartbeat); process.exit(3);
}

try {
  if (!Number.isSafeInteger(durationMs) || durationMs < 1 || durationMs !== pkg.liveProject?.format?.durationMs) await finalFail('durationMs does not match the live timeline');
  if (!pkg.document?.projectId || pkg.document.projectId === 'PLACEHOLDER_PROJECT_ID') await finalFail('package has a placeholder projectId (rebuild with --job-dir/--project-id)');
  api = makeApi(loadCreds(J, { testLocalhost: cfg.testLocalhost === true }));
  heartbeat = setInterval(() => api('/checkpoint').catch(e => log('heartbeat: ' + e.message)), Number(process.env.BG_DELIVERY_HEARTBEAT_MS) || 60000);
  const R = (fn, label) => retryUntil(fn, { label, deadline, log });
  state.storage ||= {}; status('UPLOADING', { uploaded: Object.keys(state.storage).length, total: pkg.assets.length });
  log(`start: ${pkg.assets.length} files, durationMs ${durationMs}, window ends ${new Date(deadline).toISOString()}`);

  if (!state.portableVersionId) {
    // server receipts are the source of truth for what already landed (also covers a lost resume file)
    for (let round = 1; ; round++) {
      const rec = await R(() => api('/assets', { action: 'receipts' }), 'receipts');
      const byKey = new Map((rec.receipts || []).filter(r => r.currentJob).map(r => [receiptKey(r), r.id]));
      const landedIds = new Set((rec.receipts || []).filter(r => r.currentJob).map(r => r.id));
      for (const a of pkg.assets) { const k = receiptKey(wire(a)); if (byKey.has(k)) state.storage[a.id] = byKey.get(k); else if (state.storage[a.id] && !landedIds.has(state.storage[a.id])) delete state.storage[a.id]; }
      save();
      const todo = pkg.assets.filter(a => !state.storage[a.id]);
      if (!todo.length) break;
      if (round > 5) throw Object.assign(new Error(`${todo.length} files keep failing to register as ready`), { status: 502 });
      log(`round ${round}: ${todo.length} to upload, ${pkg.assets.length - todo.length} already ready`);
      let next = 0, lastReport = 0;
      const report = async () => { const n = Object.keys(state.storage).length; status('UPLOADING', { uploaded: n, total: pkg.assets.length });
        if (Date.now() - lastReport > 10000 || n === pkg.assets.length) { lastReport = Date.now();
          await api('/progress', { stage: 'delivering', percent: 90 + Math.floor(8 * n / pkg.assets.length), message: `Your video is ready to watch. Preparing the editable version: ${n} / ${pkg.assets.length} files` }).catch(() => {}); } };
      await Promise.all(Array.from({ length: Math.min(CONC, todo.length) }, async () => {
        while (next < todo.length) {
          const a0 = todo[next++]; const a = wire(a0);
          const buf = fs.readFileSync(path.join(LIVE, a0.file));
          if (buf.length !== a.bytes || sha256Buf(buf) !== a.sha256) throw Object.assign(new Error('package file changed on disk: ' + a.filename), { status: 400 });
          state.storage[a0.id] = await R(() => uploadOne(api, { buf, kind: a.kind, mime: a.mime, filename: a.filename, sha256: a.sha256 }), a.filename);
          save(); await report();
        }
      }));
    }
    // confirm: every file ready on the server with the same sha256 + bytes
    const rec = await R(() => api('/assets', { action: 'receipts' }), 'receipts');
    const landed = new Map((rec.receipts || []).filter(r => r.currentJob).map(r => [r.id, r]));
    const missing = pkg.assets.filter(a => { const r = landed.get(state.storage[a.id]); return !r || r.sha256 !== a.sha256 || r.bytes !== a.bytes; });
    if (missing.length) throw Object.assign(new Error('not confirmed as landed: ' + missing.map(a => a.filename).slice(0, 5).join(', ')), { status: 502 });
    log(`all ${pkg.assets.length} files confirmed ready`);
    const storageOf = new Map(Object.entries(state.storage));
    const manifest = buildManifest(pkg, storageOf); const issues = checkManifest(pkg, manifest);
    if (issues.length) await finalFail('manifest failed local validation', new Error(issues.join('; ')));
    status('PUBLISHING');
    const version = await R(() => api('/portable', { manifest, theme: pkg.document.theme, overrides: pkg.document.overrides }), 'portable');
    const lp = version?.manifest?.liveProject;
    if (lp?.schema !== 'transovo.live-project/1' || lp?.format?.durationMs !== durationMs)
      await finalFail('server returned an earlier version for this job without this live timeline (publish is idempotent per job); not completing');
    state.portableVersionId = version.id; state.portableRevision = version.revision ?? null; save();
    writeJsonAtomic(path.join(LIVE, 'payload/live-publish-receipt.json'), { portableVersionId: version.id, revision: version.revision, durationMs, assets: pkg.assets.length, via: 'bg_delivery' });
    log('published portable version ' + version.id);
  }
  if (!state.completedAt) {
    status('COMPLETING', { portableVersionId: state.portableVersionId });
    try {
      await R(() => api('/complete', { delivery: 'live', portableVersionId: state.portableVersionId, durationMs }), 'complete');
    } catch (e) {
      if (e.status !== 409) throw e;
      const j = await R(() => api(''), 'job');   // a lost response to an earlier /complete also lands here
      if ((j.job || j).status !== 'complete') throw e;
      log('job was already complete on the server');
    }
    state.completedAt = new Date().toISOString(); save();
  }
  clearInterval(heartbeat);
  status('COMPLETE', { portableVersionId: state.portableVersionId, durationMs });
  fs.writeFileSync(path.join(BG, 'DONE'), new Date().toISOString() + ' portable ' + state.portableVersionId + ' durationMs ' + durationMs + '\n');
  log('DONE: editable version published and job completed (delivery:live)');
  process.exit(0);
} catch (e) {
  if (e.status === 401) await finalFail('job token or producer lease expired (the server refuses this job credential)', e);
  if (e.status === 409) await finalFail('job already finished or upload assignment changed (409)', e);
  if (e.windowExhausted) await finalFail('retry window exhausted', e);
  if (e.fatal) await finalFail(e.code || 'configuration', e);
  if (!transient(e) && e.status) await finalFail(`server refused a request (HTTP ${e.status})`, e);
  log('crash (watchdog will restart): ' + (e.stack || e.message));
  clearInterval(heartbeat); process.exit(1);
}

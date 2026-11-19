#!/usr/bin/env node
// deliver-master.mjs (foreground, step 1): upload the approved master MP4 through the job-scoped API,
// mark it as the playable result with assets {action:"approveMaster"} (the job stays OPEN; /complete is NOT called),
// and tell the customer it is ready to watch. Resumable: re-running skips what is done.
//   node deliver-master.mjs --job-dir <J> --master <J>/deliver/master.mp4 [--window-min 30]
// Exit 0 = MP4 is playable for the customer. Non-zero = not delivered (reason in <J>/deliver_bg/status.json).
import fs from 'node:fs'; import path from 'node:path';
import { loadCreds, makeApi, makeLogger, retryUntil, uploadOne, sha256File, readJson, writeJsonAtomic, receiptKey } from './lib.mjs';
const argv = process.argv.slice(2); const arg = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const J = path.resolve(arg('--job-dir') || ''); const MASTER = arg('--master') ? path.resolve(arg('--master')) : null;
if (!arg('--job-dir') || !MASTER || !fs.existsSync(MASTER)) { console.error('usage: --job-dir J --master FILE.mp4 [--window-min 30]'); process.exit(2); }
const BG = path.join(J, 'deliver_bg'); fs.mkdirSync(BG, { recursive: true, mode: 0o700 });
const log = makeLogger(path.join(BG, 'master.log'), 'master');
const stateFile = path.join(BG, 'state.json'); const state = fs.existsSync(stateFile) ? readJson(stateFile) : {};
const save = () => writeJsonAtomic(stateFile, state);
const status = (s, extra = {}) => writeJsonAtomic(path.join(BG, 'status.json'), { state: s, at: new Date().toISOString(), ...extra });
const cfg = fs.existsSync(path.join(BG, 'config.json')) ? readJson(path.join(BG, 'config.json')) : {};
const deadline = Date.now() + Number(arg('--window-min') || 30) * 60000;
try {
  const api = makeApi(loadCreds(J, { testLocalhost: cfg.testLocalhost === true }));
  const sha256 = await sha256File(MASTER); const bytes = fs.statSync(MASTER).size;
  const a = { sha256, kind: 'video', filename: 'master.mp4', bytes, mime: 'video/mp4' };
  if (state.master?.sha256 && state.master.sha256 !== sha256) { log('master file changed since last run; re-uploading'); delete state.master; }
  if (!state.master?.uploadId) {
    const receipts = await retryUntil(() => api('/assets', { action: 'receipts' }), { label: 'receipts', deadline, log });
    let uploadId = (receipts.receipts || []).find(r => r.currentJob && receiptKey(r) === receiptKey(a))?.id;
    if (uploadId) log('master already committed on the server; reusing');
    else { log(`uploading master (${(bytes / 1e6).toFixed(1)} MB)`);
      uploadId = await retryUntil(() => uploadOne(api, { buf: fs.readFileSync(MASTER), ...a }), { label: 'master upload', deadline, log }); }
    state.master = { uploadId, sha256, bytes }; save();
  }
  if (!state.master.approved) {
    await retryUntil(() => api('/assets', { action: 'approveMaster', uploadId: state.master.uploadId }), { label: 'approveMaster', deadline, log });
    state.master.approved = new Date().toISOString(); save();
    log('master approved as the playable result (job stays open)');
  }
  await api('/progress', { stage: 'delivering', percent: 90, message: 'Your video is ready to watch. We are finishing the editable version in the background.' }).catch(e => log('progress skipped: ' + e.message));
  status('MASTER_READY', { master: { bytes, sha256: sha256.slice(0, 12) } });
  log('MASTER_READY');
} catch (e) {
  const fatal = e.status === 401 ? 'job token or producer lease expired' : e.status === 409 ? 'job already finished or upload assignment changed' : e.windowExhausted ? 'retry window exhausted' : 'error';
  log(`FAILED (${fatal}): ${e.message}`); status('MASTER_FAILED', { reason: fatal, error: String(e.message).slice(0, 300) });
  process.exit(e.status === 401 || e.status === 409 ? 4 : 1);
}

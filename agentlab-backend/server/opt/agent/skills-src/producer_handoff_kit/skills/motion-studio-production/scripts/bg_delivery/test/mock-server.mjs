#!/usr/bin/env node
// Local mock of the Transovo Agent Bridge job API (agent-bridge.ts @ 83a83d5c semantics that matter here).
// NO real server is contacted. Chaos: random 500s, hung requests (client timeouts), lease/token expiry, 409 after complete.
//   MOCK_PORT=8787 MOCK_TOKEN_FILE=... MOCK_JOB_ID=msaj_... CHAOS_500=0.15 CHAOS_HANG=0.05 HANG_MS=8000 LEASE_MS=1800000 node mock-server.mjs
import http from 'node:http'; import crypto from 'node:crypto'; import fs from 'node:fs';
const PORT = Number(process.env.MOCK_PORT || 8787), JOB = process.env.MOCK_JOB_ID, TOKEN = fs.readFileSync(process.env.MOCK_TOKEN_FILE, 'utf8').trim();
const P500 = Number(process.env.CHAOS_500 || 0), PHANG = Number(process.env.CHAOS_HANG || 0), HANG = Number(process.env.HANG_MS || 8000);
const LEASE = Number(process.env.LEASE_MS || 1800000), TOKEN_TTL = Number(process.env.TOKEN_TTL_MS || 36 * 3600e3);
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const job = { id: JOB, status: 'running', phase: 'review', progress: 80, resultKey: null, artifacts: [], leaseExpiresAt: Date.now() + LEASE, tokenExpiresAt: Date.now() + TOKEN_TTL };
const blobs = new Map(); let version = null; const st = { calls: {}, chaos500: 0, chaosHang: 0, puts: 0, prepares: 0, commits: 0, dupPrepareOfReady: 0, progress: [], completeBody: null, leaseRenewals: 0, rejected401: 0, rejected409: 0 };
const done = () => ['complete', 'failed', 'cancelled'].includes(job.status);
const send = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
const KINDS = ['video', 'project', 'media', 'audio', 'source', 'font', 'image', 'bundle'];
const MIMES = ['video/mp4','video/webm','video/quicktime','application/json','image/png','image/jpeg','image/webp','image/svg+xml','audio/mpeg','audio/wav','audio/x-wav','audio/mp4','text/plain','text/vtt','application/x-subrip','application/zip','font/ttf','font/otf','font/woff','font/woff2','application/octet-stream','application/wasm','application/javascript','text/javascript','text/css'];
async function body(req) { const c = []; for await (const x of req) c.push(x); return Buffer.concat(c); }
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  if (u.pathname === '/__state') return send(res, 200, { ...st, progressLog: st.progress, progress: job.progress, status: job.status, phase: job.phase, resultKey: job.resultKey, customerCanPlayMp4: Boolean(job.resultKey) && !done(),
    artifacts: job.artifacts.length, ready: job.artifacts.filter(a => a.state === 'ready').length, version: version && { id: version.id, assets: version.manifest.assets.length } });
  if (u.pathname === '/__chaos') { const b = JSON.parse((await body(req)).toString() || '{}'); Object.assign(globalThis, b); return send(res, 200, { ok: true }); }
  if (u.pathname === '/__expire_lease') { job.leaseExpiresAt = 0; job.noRenew = true; return send(res, 200, { ok: true }); }
  const chaosP500 = globalThis.P500 ?? P500, chaosHang = globalThis.PHANG ?? PHANG;
  if (Math.random() < chaosHang) { st.chaosHang++; await new Promise(r => setTimeout(r, HANG)); if (res.destroyed) return; }
  if (Math.random() < chaosP500) { st.chaos500++; return send(res, 500, { error: 'chaos 500' }); }
  if (u.pathname.startsWith('/__storage/')) {   // signed PUT target
    const id = u.pathname.split('/')[2]; const a = job.artifacts.find(x => x.id === id);
    if (!a || u.searchParams.get('sig') !== a.sig) return send(res, 403, { error: 'bad signature' });
    blobs.set(id, await body(req)); st.puts++; await new Promise(r => setTimeout(r, Number(process.env.MOCK_PUT_DELAY_MS || 0))); res.writeHead(200); return res.end();
  }
  const base = '/api/motion-studio/agent/jobs/' + JOB; if (!u.pathname.startsWith(base)) return send(res, 404, { error: 'not found' });
  const route = u.pathname.slice(base.length) || '/'; st.calls[req.method + ' ' + route] = (st.calls[req.method + ' ' + route] || 0) + 1;
  const auth = req.headers.authorization || '';
  if (auth !== 'Bearer ' + TOKEN || Date.now() > job.tokenExpiresAt) { st.rejected401++; return send(res, 401, { error: 'Invalid or expired job token.' }); }
  if (!done() && job.leaseExpiresAt <= Date.now()) { st.rejected401++; return send(res, 401, { error: 'Producer lease expired; claim this job again.' }); }
  if (!done() && !job.noRenew) { job.leaseExpiresAt = Date.now() + LEASE; st.leaseRenewals++; }
  const raw = req.method === 'POST' ? JSON.parse((await body(req)).toString() || '{}') : {};
  const c409 = m => { st.rejected409++; return send(res, 409, { error: m }); };
  if (req.method === 'GET' && route === '/') return send(res, 200, { job: { id: JOB, status: job.status, phase: job.phase, progress: job.progress } });
  if (req.method === 'GET' && route === '/checkpoint') return send(res, 200, { status: job.status, checkpoint: null });
  if (route === '/progress') { if (done()) return c409('Job already finished.');
    job.progress = Math.max(job.progress, Math.min(99, Math.round(Number(raw.percent ?? raw.progress ?? job.progress)))); job.phase = raw.stage || job.phase;
    st.progress.push(`${job.progress} ${String(raw.message || '').slice(0, 120)}`); return send(res, 200, { job: { status: job.status } }); }
  if (route === '/assets') {
    if (done()) return c409('Job already finished.');
    if (raw.action === 'receipts') return send(res, 200, { receipts: job.artifacts.filter(a => a.state === 'ready' && a.sha256).map(({ id, sha256, kind, filename, bytes, mime }) => ({ id, sha256, kind, filename, bytes, mime, currentJob: true })) });
    if (raw.action === 'prepare') { st.prepares++;
      const filename = String(raw.filename || '').slice(0, 150).replace(/[^a-zA-Z0-9._-]/g, '_'), bytes = Number(raw.bytes), checksum = String(raw.sha256 || '').toLowerCase();
      if (!filename || !KINDS.includes(raw.kind) || !MIMES.includes(raw.mime) || !(bytes >= 1) ||
        (raw.mime === 'application/octet-stream' && (raw.kind !== 'source' || !checksum || bytes > 16 * 1024 * 1024 || !filename.endsWith('.frames'))) ||
        (['font', 'image', 'bundle'].includes(raw.kind) && (!checksum || bytes > 25 * 1024 * 1024))) return send(res, 400, { error: 'Invalid upload.' });
      const ready = job.artifacts.find(a => a.state === 'ready' && a.sha256 === checksum && a.kind === raw.kind && a.filename === filename && a.bytes === bytes);
      if (ready) { st.dupPrepareOfReady++; if (raw.resume) return send(res, 200, { uploadId: ready.id, exists: true }); }
      const id = crypto.randomUUID(), sig = crypto.randomBytes(8).toString('hex');
      job.artifacts.push({ id, sig, kind: raw.kind, mime: raw.mime, filename, bytes, sha256: checksum || null, state: 'pending', key: 'k/' + id });
      return send(res, 200, { uploadId: id, objectKey: 'k/' + id, mode: 'signed_put', signedPut: { url: `http://127.0.0.1:${PORT}/__storage/${id}?sig=${sig}` } });
    }
    if (raw.action === 'commit') { st.commits++; const a = job.artifacts.find(x => x.id === raw.uploadId); const b = a && blobs.get(a.id);
      if (!a || !b) return send(res, 400, { error: 'Upload not found in storage.' });
      if (b.length !== a.bytes || (a.sha256 && sha(b) !== a.sha256)) return send(res, 400, { error: 'Checksum mismatch.' });
      a.state = 'ready'; return send(res, 200, { uploadId: a.id, status: 'ready', bytes: a.bytes }); }
    if (raw.action === 'approveMaster') { const a = job.artifacts.find(x => x.id === raw.uploadId && x.state === 'ready' && x.kind === 'video' && x.mime === 'video/mp4' && x.filename !== 'editor-base.mp4');
      if (!a) return send(res, 400, { error: 'A committed MP4 master is required.' }); job.resultKey = a.key; return send(res, 200, { videoReady: true }); }
    return send(res, 400, { error: 'Unknown action.' });
  }
  if (route === '/portable') {
    if (done()) return c409('Job already finished.');
    if (version) return send(res, 200, version);   // idempotent per job: the FIRST version wins
    const m = raw.manifest; if (!m?.assets) return send(res, 400, { error: 'manifest required' });
    for (const a of m.assets) { const r = job.artifacts.find(x => x.id === a.id && x.state === 'ready'); if (!r || r.sha256 !== a.sha256) return send(res, 409, { error: 'Every portable asset must be ready.' }); }
    version = { id: 'mspv_' + crypto.randomUUID().replace(/-/g, ''), revision: 1, sourceJobId: JOB, status: 'committed', manifest: m };
    return send(res, 200, version);
  }
  if (route === '/complete') {
    if (job.status === 'complete') return send(res, 200, { job: { status: job.status } });   // harmless repeat
    if (done()) return c409('Job already finished.');
    st.completeBody = raw;
    if (raw.status === 'failed') { job.status = 'failed'; return send(res, 200, { job: { status: job.status } }); }
    if (raw.delivery === 'live') {
      if (!raw.portableVersionId || !Number.isSafeInteger(raw.durationMs)) return send(res, 400, { error: 'Live delivery requires its committed version and duration.' });
      if (!version || version.id !== raw.portableVersionId) return c409('The live project must be published by this job first.');
      if (version.manifest.liveProject?.format?.durationMs !== raw.durationMs) return send(res, 400, { error: 'Live project duration or track format is missing.' });
      if (!version.manifest.assets.every(a => job.artifacts.some(x => x.id === a.id && x.state === 'ready'))) return c409('All live scene, audio and caption assets must be ready.');
      job.status = 'complete'; job.phase = 'complete'; job.progress = 100; job.resultKey = null; return send(res, 200, { job: { status: job.status } });
    }
    if (!job.resultKey) return c409('Upload and commit an MP4 before completing.');
    job.status = 'complete'; job.progress = 100; return send(res, 200, { job: { status: job.status } });
  }
  send(res, 404, { error: 'no route' });
}).listen(PORT, '127.0.0.1', () => console.log('mock listening on 127.0.0.1:' + PORT));

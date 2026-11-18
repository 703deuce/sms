#!/usr/bin/env node
// Simulated Transovo storage + job API (local only). Stands in for the endpoints ChatGPT will implement on Transovo.
// NOT the real server. Everything lives under $TRANSOVO_SIM_ROOT. Signed URLs are HMAC'd with a per-start secret and never logged.
//   node sim/transovo-sim.mjs --root <dir> --port 8787
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { unpackFrame } from '../producer/lib/frame-packs.mjs';
import { pipeline } from 'node:stream/promises';
const arg = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, r) => (v.startsWith('--') && a.push([v.slice(2), r[i + 1]]), a), []));
const ROOT = path.resolve(arg.root || process.env.TRANSOVO_SIM_ROOT || './_transovo_sim'); const PORT = Number(arg.port || 8787);
const SECRET = crypto.randomBytes(32); const API = '/api/motion-studio';
const KINDS = ['video', 'project', 'media', 'audio', 'source', 'font', 'image', 'bundle'];   // first five = existing Agent Bridge kinds
for (const d of ['blobs', 'assets', 'uploads', 'projects', 'jobs', 'workers', 'fonts']) fs.mkdirSync(path.join(ROOT, d), { recursive: true });
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8')); const W = (p, v) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p + '.tmp', JSON.stringify(v, null, 1)); fs.renameSync(p + '.tmp', p); };
const now = () => new Date().toISOString();
const sign = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('hex').slice(0, 32);
const tokHash = (t) => crypto.createHash('sha256').update(t).digest('hex');
const assetPath = (id) => path.join(ROOT, 'assets', id + '.json');
const blobPath = (sha) => path.join(ROOT, 'blobs', sha.slice(0, 2), sha);
const send = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
const err = (res, code, error, extra = {}) => send(res, code, { error, ...extra });
const body = (req) => new Promise((r, j) => { let b = ''; req.on('data', d => { b += d; if (b.length > 64 * 1024 * 1024) j(new Error('too big')); }); req.on('end', () => { try { r(b ? JSON.parse(b) : {}); } catch (e) { j(e); } }); });
const log = (m) => fs.appendFileSync(path.join(ROOT, 'server.log'), `${now()} ${m}\n`);
function auth(req, scope) { // job-scoped bearer token (same model as today's Agent Bridge). Returns job or null.
  const m = /^Bearer (\S+)$/.exec(req.headers.authorization || ''); if (!m) return null;
  const p = path.join(ROOT, 'jobs', 'tokens', tokHash(m[1]) + '.json'); if (!fs.existsSync(p)) return null;
  const t = J(p); if (Date.parse(t.expiresAt) < Date.now()) return null; if (scope && t.projectId !== scope) return null; return t;
}
const signedUrl = (kind, id, ttl = 1800) => { const exp = Math.floor(Date.now() / 1000) + ttl; return { url: `http://127.0.0.1:${PORT}/_${kind}/${id}?exp=${exp}&sig=${sign(kind + id + exp)}`, expiresAt: new Date(exp * 1000).toISOString() }; };
const checkSig = (kind, id, q) => q.get('sig') === sign(kind + id + q.get('exp')) && Number(q.get('exp')) * 1000 > Date.now();
const head = (pid) => { const d = path.join(ROOT, 'projects', pid, 'versions'); if (!fs.existsSync(d)) return 0; return Math.max(0, ...fs.readdirSync(d).filter(f => /^\d+\.json$/.test(f)).map(f => +f.split('.')[0])); };

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'); const p = u.pathname; const M = req.method;
  try {
    // ---------- signed blob transfer (no bearer: the signature is the capability) ----------
    let m;
    if ((m = /^\/_upload\/(upl_[a-f0-9]+)$/.exec(p)) && M === 'PUT') {
      if (!checkSig('upload', m[1], u.searchParams)) return err(res, 403, 'bad_signature');
      const up = path.join(ROOT, 'uploads', m[1]); await pipeline(req, fs.createWriteStream(up + '.part')); fs.renameSync(up + '.part', up + '.bin');
      return send(res, 200, { ok: true });
    }
    if ((m = /^\/_blob\/((?:ast|fnt|bnd)_[a-f0-9]+)$/.exec(p)) && M === 'GET') {
      if (!checkSig('blob', m[1], u.searchParams)) return err(res, 403, 'bad_signature');
      const a = J(assetPath(m[1])); res.writeHead(200, { 'Content-Type': a.mime, 'Content-Length': a.bytes, 'Access-Control-Allow-Origin': '*' });
      return fs.createReadStream(blobPath(a.sha256)).pipe(res);
    }
    // ---------- scene runtime origin: serves immutable bundle files to the sandboxed editor iframe ----------
    // /_scene/<bundleId>/<exp>/<sig>/<relative path>. Relative imports inside the bundle keep working; CSP blocks any other network.
    if ((m = /^\/_scene\/(bnd_[a-f0-9]+)\/(\d+)\/([a-f0-9]{32})\/(.+)$/.exec(p)) && M === 'GET') {
      if (m[3] !== sign('scene' + m[1] + m[2]) || Number(m[2]) * 1000 < Date.now()) return err(res, 403, 'bad_signature');
      const bdoc = JSON.parse(fs.readFileSync(blobPath(J(assetPath(m[1])).sha256), 'utf8')); const rel = decodeURIComponent(m[4]);
      const fe = bdoc.files[rel]; if (!fe) return err(res, 404, 'not_in_bundle');
      const a = J(assetPath(fe.asset));
      const frame = fe.packSha256 ? unpackFrame(fs.readFileSync(blobPath(a.sha256)), fe) : null;
      const mime = frame ? (/\.png$/i.test(rel) ? 'image/png' : /\.webp$/i.test(rel) ? 'image/webp' : 'image/jpeg') : a.mime;
      res.writeHead(200, { 'Content-Type': mime, 'Content-Length': frame ? frame.length : a.bytes, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'private, max-age=3600, immutable',
        'Content-Security-Policy': `default-src 'self' http://127.0.0.1:${PORT}; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: http://127.0.0.1:${PORT}; font-src 'self' data: http://127.0.0.1:${PORT}; media-src 'self' blob: http://127.0.0.1:${PORT}; connect-src 'self' http://127.0.0.1:${PORT}; frame-ancestors http://127.0.0.1:* http://localhost:*; base-uri 'none'; form-action 'none'`,
        'X-Content-Type-Options': 'nosniff' });
      if (frame) return res.end(frame);
      return fs.createReadStream(blobPath(a.sha256)).pipe(res);
    }
    if (p.startsWith('/_sim/editor/') && M === 'GET') { const f = path.join(path.dirname(new URL(import.meta.url).pathname), 'editor-host', path.normalize(p.slice('/_sim/editor/'.length)).replace(/^(\.\.[/\\])+/, ''));
      if (!fs.existsSync(f)) return err(res, 404, 'not_found'); const ext = path.extname(f); res.writeHead(200, { 'Content-Type': ext === '.html' ? 'text/html' : ext === '.js' || ext === '.mjs' ? 'text/javascript' : 'application/octet-stream' }); return fs.createReadStream(f).pipe(res); }
    if (!p.startsWith(API)) return err(res, 404, 'not_found');
    const r = p.slice(API.length);
    // ---------- sim-only coordinator endpoint: create a job + token (Transovo side in reality) ----------
    if (r === '/_sim/jobs' && M === 'POST') {
      const b = await body(req); const jobId = 'msaj_' + crypto.randomUUID(); const token = crypto.randomBytes(24).toString('base64url');
      const job = { id: jobId, projectId: b.projectId, workspaceId: b.workspaceId || 'ws_sim', mode: b.mode, action: b.action, status: 'queued', phase: 'queued', progress: 0, createdAt: now(), input: b.input || {}, assignedWorker: b.workerId || null, artifacts: [], events: 0 };
      W(path.join(ROOT, 'jobs', jobId, 'job.json'), job); W(path.join(ROOT, 'jobs', 'tokens', tokHash(token) + '.json'), { jobId, projectId: b.projectId, expiresAt: new Date(Date.now() + 36 * 3600e3).toISOString() });
      log(`job created ${jobId} mode=${b.mode} project=${b.projectId}`);
      return send(res, 201, { jobId, jobToken: token, jobUrl: `http://127.0.0.1:${PORT}${API}/agent/jobs/${jobId}`, apiBase: `http://127.0.0.1:${PORT}${API}` });
    }
    if (r === '/_sim/state' && M === 'GET') return send(res, 200, { root: '[sim]', projects: fs.readdirSync(path.join(ROOT, 'projects')), assets: fs.readdirSync(path.join(ROOT, 'assets')).length });
    // ---------- worker registry + usage (Transovo owns scheduling; workers only report) ----------
    if ((m = /^\/workers\/([A-Za-z0-9_.-]+)$/.exec(r))) {
      if (M === 'PUT') { const b = await body(req); W(path.join(ROOT, 'workers', m[1], 'registration.json'), { ...b, receivedAt: now() }); return send(res, 200, { ok: true, workerId: m[1] }); }
      if (M === 'GET') { const f = path.join(ROOT, 'workers', m[1], 'registration.json'); return fs.existsSync(f) ? send(res, 200, J(f)) : err(res, 404, 'unknown_worker'); }
    }
    if ((m = /^\/workers\/([A-Za-z0-9_.-]+)\/(usage|heartbeat)$/.exec(r)) && M === 'POST') {
      const b = await body(req); fs.mkdirSync(path.join(ROOT, 'workers', m[1]), { recursive: true });
      fs.appendFileSync(path.join(ROOT, 'workers', m[1], m[2] + '.jsonl'), JSON.stringify({ ...b, receivedAt: now() }) + '\n'); return send(res, 202, { ok: true });
    }
    // everything below needs a job token
    const job = auth(req); if (!job) return err(res, 401, 'unauthorized');
    // ---------- assets ----------
    if (r === '/assets' && M === 'POST') {
      const b = await body(req);
      if (b.action === 'prepare') {
        if (!KINDS.includes(b.kind)) return err(res, 400, 'bad_kind', { allowed: KINDS });
        if (!/^[a-f0-9]{64}$/.test(b.sha256 || '')) return err(res, 400, 'sha256_required');
        if (!(b.bytes >= 0 && b.bytes <= 2e9)) return err(res, 400, 'bad_bytes');
        const prefix = b.kind === 'font' ? 'fnt_' : b.kind === 'bundle' ? 'bnd_' : 'ast_';
        const assetId = prefix + b.sha256.slice(0, 32);          // content-addressed: same bytes -> same id (dedupe)
        if (fs.existsSync(assetPath(assetId))) return send(res, 200, { assetId, exists: true, status: 'ready' });
        const uploadId = 'upl_' + crypto.randomBytes(12).toString('hex');
        W(path.join(ROOT, 'uploads', uploadId + '.json'), { uploadId, assetId, jobId: job.jobId, projectId: job.projectId, filename: String(b.filename || '').replace(/[^a-zA-Z0-9._-]/g, '_'), kind: b.kind, mime: b.mime, bytes: b.bytes, sha256: b.sha256, meta: b.meta || {} });
        return send(res, 200, { assetId, uploadId, mode: 'signed_put', signedPut: signedUrl('upload', uploadId) });
      }
      if (b.action === 'commit') {
        const f = path.join(ROOT, 'uploads', b.uploadId + '.json'); if (!fs.existsSync(f)) return err(res, 404, 'unknown_upload');
        const up = J(f); const bin = path.join(ROOT, 'uploads', b.uploadId + '.bin'); if (!fs.existsSync(bin)) return err(res, 409, 'object_missing');
        const h = crypto.createHash('sha256'); await pipeline(fs.createReadStream(bin), h); const sha = h.digest('hex'); const size = fs.statSync(bin).size;
        if (sha !== up.sha256 || size !== up.bytes) { fs.unlinkSync(bin); return err(res, 422, 'integrity_mismatch'); }
        const bp = blobPath(sha); fs.mkdirSync(path.dirname(bp), { recursive: true }); if (!fs.existsSync(bp)) fs.renameSync(bin, bp); else fs.unlinkSync(bin);
        const rec = { assetId: up.assetId, sha256: sha, bytes: size, mime: up.mime, kind: up.kind, filename: up.filename, meta: up.meta, projectId: up.projectId, createdByJob: up.jobId, createdAt: now() };
        W(assetPath(up.assetId), rec); fs.unlinkSync(f); return send(res, 200, { assetId: up.assetId, status: 'ready', bytes: size, sha256: sha });
      }
      return err(res, 400, 'bad_action');
    }
    if (r === '/assets/lookup' && M === 'POST') { const b = await body(req); const found = {}; for (const s of b.sha256 || []) for (const pre of ['ast_', 'fnt_', 'bnd_']) if (fs.existsSync(assetPath(pre + s.slice(0, 32)))) found[s] = pre + s.slice(0, 32); return send(res, 200, { found }); }
    if ((m = /^\/assets\/((?:ast|fnt|bnd)_[a-f0-9]+)$/.exec(r)) && M === 'GET') {
      if (!fs.existsSync(assetPath(m[1]))) return err(res, 404, 'unknown_asset');
      return send(res, 200, { asset: J(assetPath(m[1])), download: signedUrl('blob', m[1]) });
    }
    // ---------- immutable project versions ----------
    if ((m = /^\/projects\/([A-Za-z0-9_-]+)\/versions$/.exec(r))) {
      const dir = path.join(ROOT, 'projects', m[1], 'versions');
      if (job.projectId !== m[1]) return err(res, 403, 'wrong_project');
      if (M === 'GET') { const h = head(m[1]); const list = []; for (let v = 1; v <= h; v++) { const d = J(path.join(dir, v + '.json')); list.push({ version: v, parentVersion: d.parentVersion ?? null, createdAt: d.createdAt, createdBy: d.createdBy, changes: d.changes || [] }); } return send(res, 200, { projectId: m[1], head: h, versions: list }); }
      if (M === 'POST') {
        if (job.projectId !== m[1]) return err(res, 403, 'wrong_project');
        const b = await body(req); const h = head(m[1]);
        if ((b.baseVersion ?? 0) !== h) return err(res, 409, 'version_conflict', { head: h });
        const doc = b.document; if (!doc || doc.projectId !== m[1] || doc.version !== h + 1) return err(res, 422, 'bad_document', { expectedVersion: h + 1 });
        const missing = (doc.assetRefs || []).filter(id => !fs.existsSync(assetPath(id))); if (missing.length) return err(res, 422, 'missing_assets', { missing: missing.slice(0, 20), count: missing.length });
        const f = path.join(dir, doc.version + '.json'); fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(f, JSON.stringify(doc, null, 1), { flag: 'wx' });   // write-once: a published version can never be overwritten
        log(`project ${m[1]} v${doc.version} published by job ${job.jobId}`); return send(res, 201, { projectId: m[1], version: doc.version, head: doc.version });
      }
    }
    if ((m = /^\/projects\/([A-Za-z0-9_-]+)\/versions\/(\d+)$/.exec(r)) && M === 'GET') { if (job.projectId !== m[1]) return err(res, 403, 'wrong_project'); const f = path.join(ROOT, 'projects', m[1], 'versions', m[2] + '.json'); return fs.existsSync(f) ? send(res, 200, J(f)) : err(res, 404, 'unknown_version'); }
    // ---------- editor scene session: iframe URL + host payload for one scene of one version ----------
    if ((m = /^\/projects\/([A-Za-z0-9_-]+)\/versions\/(\d+)\/scenes\/([A-Za-z0-9_-]+)\/session$/.exec(r)) && M === 'POST') {
      if (job.projectId !== m[1]) return err(res, 403, 'wrong_project');
      const vf = path.join(ROOT, 'projects', m[1], 'versions', m[2] + '.json'); if (!fs.existsSync(vf)) return err(res, 404, 'unknown_version');
      const doc = J(vf); const sc = doc.scenes.find(x => x.sceneId === m[3]); if (!sc) return err(res, 404, 'unknown_scene');
      const bdoc = JSON.parse(fs.readFileSync(blobPath(J(assetPath(sc.bundle)).sha256), 'utf8'));
      const exp = Math.floor(Date.now() / 1000) + 3600; const base = `http://127.0.0.1:${PORT}/_scene/${sc.bundle}/${exp}/${sign('scene' + sc.bundle + exp)}/`;
      const ids = new Set([...(bdoc.liveAssets || [])]); JSON.stringify([doc.theme, doc.overrides], (k, v) => { if (k === 'asset' && typeof v === 'string') ids.add(v); if (k === 'faces' && Array.isArray(v)) v.forEach(x => ids.add(x.split('.')[0])); return v; });
      const b = await body(req); (b.extraAssets || []).forEach(x => ids.add(x));
      const assetUrls = {}, assets = {}; for (const id of ids) { if (!fs.existsSync(assetPath(id))) continue; const a = J(assetPath(id)); assetUrls[id] = signedUrl('blob', id, 3600).url; assets[id] = { mime: a.mime, bytes: a.bytes, width: a.meta && a.meta.width, height: a.meta && a.meta.height, meta: a.meta }; }
      return send(res, 200, { sceneUrl: base + bdoc.entry, sceneOrigin: `http://127.0.0.1:${PORT}`, expiresAt: new Date(exp * 1000).toISOString(), livePreview: bdoc.capabilities && bdoc.capabilities.livePreview,
        host: { theme: doc.theme, overrides: doc.overrides || {}, assetUrls, assets, fonts: Object.fromEntries((doc.fontRecords || []).map(f => [f.fontId, f])), mode: 'live' },
        fallback: sc.preview || null });
    }
    // ---------- editor: records + signed URLs for fonts/assets picked during live editing (font picker, logo upload) ----------
    if ((m = /^\/projects\/([A-Za-z0-9_-]+)\/preview-assets$/.exec(r)) && M === 'POST') {
      if (job.projectId !== m[1]) return err(res, 403, 'wrong_project'); const b = await body(req); const ids = (b.ids || []).slice(0, 200).map(String);
      let idx = null; const out = { assetUrls: {}, assets: {}, fonts: {}, missing: [] };
      for (const id of ids) { const base = id.split('.')[0]; if (!/^(ast|fnt)_[a-f0-9]{32}$/.test(base) || !fs.existsSync(assetPath(base))) { out.missing.push(id); continue; }
        const a = J(assetPath(base)); out.assetUrls[base] = signedUrl('blob', base, 3600).url; out.assets[base] = { mime: a.mime, bytes: a.bytes, width: a.meta && a.meta.width, height: a.meta && a.meta.height, meta: a.meta };
        if (id.startsWith('fnt_')) { if (!idx) { const f = path.join(ROOT, 'fonts', 'index.json'); idx = fs.existsSync(f) ? J(f).fonts : []; } const rec = idx.find(x => x.fontId === id); if (rec) out.fonts[id] = rec; else out.missing.push(id); } }
      return send(res, 200, out);
    }
    // ---------- engine font catalogs ----------
    if ((m = /^\/fonts\/catalog\/([a-z0-9_.-]+)$/.exec(r))) {
      const f = path.join(ROOT, 'fonts', m[1] + '.json');
      if (M === 'PUT') { const b = await body(req); W(f, { ...b, receivedAt: now() }); return send(res, 200, { ok: true, engine: m[1], fonts: (b.fonts || []).length }); }
      if (M === 'GET') return fs.existsSync(f) ? send(res, 200, J(f)) : err(res, 404, 'no_catalog');
    }
    // ---------- job API (same shape as today's Agent Bridge, plus events/checkpoint) ----------
    if ((m = /^\/agent\/jobs\/(msaj_[a-f0-9-]+)(\/[a-z]+)?$/.exec(r))) {
      if (job.jobId !== m[1]) return err(res, 403, 'wrong_job');
      const jf = path.join(ROOT, 'jobs', m[1], 'job.json'); const jj = J(jf); const sub = m[2] || '';
      if (sub === '' && M === 'GET') return send(res, 200, { job: jj });
      if (['completed', 'failed'].includes(jj.status) && sub !== '/complete' && M !== 'GET') return err(res, 409, 'job_finished');
      const b = M === 'GET' ? {} : await body(req);
      if (sub === '/progress' && M === 'POST') { jj.status = 'running'; jj.phase = String(b.phase || '').slice(0, 60); jj.progress = Math.max(jj.progress, Math.min(99, Number(b.progress) || 0)); jj.message = String(b.message || '').slice(0, 500); jj.updatedAt = now(); W(jf, jj); return send(res, 200, { job: jj }); }
      if (sub === '/events' && M === 'POST') { fs.appendFileSync(path.join(ROOT, 'jobs', m[1], 'events.jsonl'), JSON.stringify({ ...b, receivedAt: now() }) + '\n'); jj.events++; if (b.type === 'artifact') jj.artifacts.push(b.artifact); W(jf, jj); return send(res, 202, { ok: true }); }
      if (sub === '/checkpoint' && M === 'PUT') { const cf = path.join(ROOT, 'jobs', m[1], 'checkpoint.json'); const cur = fs.existsSync(cf) ? J(cf) : { revision: 0 }; if (!(b.revision > cur.revision)) return err(res, 409, 'stale_checkpoint', { revision: cur.revision }); if (JSON.stringify(b).length > 256 * 1024) return err(res, 413, 'too_big'); W(cf, b); return send(res, 200, { ok: true, revision: b.revision }); }
      if (sub === '/checkpoint' && M === 'GET') { const cf = path.join(ROOT, 'jobs', m[1], 'checkpoint.json'); return send(res, 200, fs.existsSync(cf) ? J(cf) : { revision: 0, checkpoint: null }); }
      if (sub === '/complete' && M === 'POST') { if (!['completed', 'failed'].includes(jj.status)) { jj.status = b.status === 'failed' ? 'failed' : 'completed'; jj.completedAt = now(); jj.result = b; W(jf, jj); } return send(res, 200, { job: jj }); }
    }
    return err(res, 404, 'not_found');
  } catch (e) { log('ERR ' + e.message); return err(res, 500, 'server_error'); }
});
server.listen(PORT, '127.0.0.1', () => { console.log(`transovo-sim listening on 127.0.0.1:${PORT} root=${ROOT}`); log('start'); });

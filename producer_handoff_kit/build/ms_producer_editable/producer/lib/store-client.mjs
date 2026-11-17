// Client for Transovo storage + job API (the simulated server implements the same contract; see docs/TRANSOVO_INTEGRATION.md).
// Never logs URLs or tokens. Verifies sha256 of everything it downloads.
import fs from 'node:fs'; import path from 'node:path'; import { Readable } from 'node:stream';
import { sha256File, sha256, mimeOf, redact } from './util.mjs';

export class StoreClient {
  constructor({ apiBase, jobToken }) { this.base = apiBase.replace(/\/$/, ''); this.tok = jobToken; this.cacheIndex = new Map(); }
  async api(method, p, body) {
    const r = await fetch(this.base + p, { method, headers: { Authorization: 'Bearer ' + this.tok, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = { raw: t.slice(0, 200) }; }
    if (!r.ok) { const e = new Error(`${method} ${p} -> ${r.status} ${redact(JSON.stringify(j)).slice(0, 400)}`); e.status = r.status; e.body = j; throw e; }
    return j;
  }
  // ---- assets ----
  async uploadFile(file, { kind, mime, filename, meta } = {}) {
    const sha = await sha256File(file); const bytes = fs.statSync(file).size;
    const prep = await this.api('POST', '/assets', { action: 'prepare', filename: filename || path.basename(file), kind, mime: mime || mimeOf(file), bytes, sha256: sha, meta });
    if (prep.exists) return { assetId: prep.assetId, sha256: sha, bytes, reused: true };
    const put = await fetch(prep.signedPut.url, { method: 'PUT', body: Readable.toWeb(fs.createReadStream(file)), duplex: 'half', headers: { 'Content-Type': mime || mimeOf(file), 'Content-Length': String(bytes) } });
    if (!put.ok) throw new Error('upload PUT failed ' + put.status);
    const c = await this.api('POST', '/assets', { action: 'commit', uploadId: prep.uploadId });
    return { assetId: c.assetId, sha256: sha, bytes, reused: false };
  }
  async uploadBuffer(buf, { kind, mime, filename, meta }) {
    const sha = sha256(buf);
    const prep = await this.api('POST', '/assets', { action: 'prepare', filename, kind, mime, bytes: buf.length, sha256: sha, meta });
    if (prep.exists) return { assetId: prep.assetId, sha256: sha, bytes: buf.length, reused: true };
    const put = await fetch(prep.signedPut.url, { method: 'PUT', body: buf, headers: { 'Content-Type': mime } }); if (!put.ok) throw new Error('upload PUT failed ' + put.status);
    const c = await this.api('POST', '/assets', { action: 'commit', uploadId: prep.uploadId });
    return { assetId: c.assetId, sha256: sha, bytes: buf.length, reused: false };
  }
  uploadJson(obj, opts) { return this.uploadBuffer(Buffer.from(JSON.stringify(obj, null, 1)), { kind: 'project', mime: 'application/json', ...opts }); }
  assetInfo(id) { return this.api('GET', '/assets/' + id); }
  // download into a content-addressed cache; returns local path. Verifies sha256.
  async fetchAsset(id, cacheDir) {
    const info = await this.assetInfo(id); const a = info.asset;
    const dest = path.join(cacheDir, 'blobs', a.sha256.slice(0, 2), a.sha256);
    if (fs.existsSync(dest) && fs.statSync(dest).size === a.bytes) return { path: dest, asset: a };
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const r = await fetch(info.download.url); if (!r.ok) throw new Error('download failed ' + r.status + ' for ' + id);
    const tmp = dest + '.part'; const ws = fs.createWriteStream(tmp);
    await new Promise((res, rej) => { Readable.fromWeb(r.body).pipe(ws).on('finish', res).on('error', rej); });
    const got = await sha256File(tmp); if (got !== a.sha256) { fs.unlinkSync(tmp); throw new Error('integrity mismatch for ' + id); }
    fs.renameSync(tmp, dest); return { path: dest, asset: a };
  }
  async fetchJson(id, cacheDir) { const { path: p } = await this.fetchAsset(id, cacheDir); return JSON.parse(fs.readFileSync(p, 'utf8')); }
  // ---- project versions ----
  listVersions(pid) { return this.api('GET', `/projects/${pid}/versions`); }
  getVersion(pid, v) { return this.api('GET', `/projects/${pid}/versions/${v}`); }
  publishVersion(pid, baseVersion, document) { return this.api('POST', `/projects/${pid}/versions`, { baseVersion, document }); }
  // ---- fonts ----
  putFontCatalog(engine, cat) { return this.api('PUT', '/fonts/catalog/' + engine, cat); }
  getFontCatalog(engine) { return this.api('GET', '/fonts/catalog/' + engine); }
  // ---- jobs ----
  job(jobId) { return this.api('GET', `/agent/jobs/${jobId}`); }
  progress(jobId, phase, progress, message) { return this.api('POST', `/agent/jobs/${jobId}/progress`, { phase, progress, message }); }
  event(jobId, ev) { return this.api('POST', `/agent/jobs/${jobId}/events`, { at: new Date().toISOString(), ...ev }); }
  checkpoint(jobId, revision, checkpoint) { return this.api('PUT', `/agent/jobs/${jobId}/checkpoint`, { revision, checkpoint }); }
  complete(jobId, b) { return this.api('POST', `/agent/jobs/${jobId}/complete`, b); }
  // ---- workers ----
  registerWorker(id, reg) { return this.api('PUT', `/workers/${id}`, reg); }
  usage(id, obs) { return this.api('POST', `/workers/${id}/usage`, obs); }
  heartbeat(id, hb) { return this.api('POST', `/workers/${id}/heartbeat`, hb); }
}

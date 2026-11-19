// bg_delivery/lib.mjs: shared helpers for the render-first / editable-in-background delivery path.
// Never logs tokens, signed URLs or Authorization headers.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

export const SELF = path.dirname(new URL(import.meta.url).pathname);
export const sha256Buf = b => crypto.createHash('sha256').update(b).digest('hex');
export const sha256File = p => new Promise((res, rej) => { const h = crypto.createHash('sha256'); fs.createReadStream(p).on('data', d => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej); });
export const nowEt = () => new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false }).replace(',', '') + ' ET';
export const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
export function writeJsonAtomic(p, v) { fs.mkdirSync(path.dirname(p), { recursive: true }); const t = p + '.tmp' + process.pid; fs.writeFileSync(t, JSON.stringify(v, null, 1)); fs.renameSync(t, p); }

let SECRET_STRINGS = [];
export function redact(s) {
  let out = String(s);
  for (const x of SECRET_STRINGS) if (x) out = out.split(x).join('[redacted]');
  return out.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').replace(/https?:\/\/[^\s"'<>)]+/gi, '[url]');
}
export function makeLogger(file, tag) {
  return (...a) => { const line = `${nowEt()} [${tag}] ` + redact(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')); try { fs.appendFileSync(file, line + '\n'); } catch {} console.log(line); };
}

// Credentials come only from <job>/secrets (mode 600). The job URL must be https on transovo.ai;
// the ONLY exception is a local mock at http://127.0.0.1 when the job's bg config says testLocalhost:true.
export function loadCreds(jobDir, { testLocalhost = false } = {}) {
  const rd = n => { const p = path.join(jobDir, 'secrets', n); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() : ''; };
  const jobUrl = rd('job_url').replace(/\/$/, ''), token = rd('token');
  if (!jobUrl || !token) throw Object.assign(new Error('job secrets missing (secrets/job_url, secrets/token)'), { fatal: true, code: 'NO_CREDS' });
  const u = new URL(jobUrl);
  const prodOk = u.protocol === 'https:' && /(^|\.)transovo\.ai$/.test(u.hostname);
  const mockOk = testLocalhost && u.protocol === 'http:' && u.hostname === '127.0.0.1';
  if (!prodOk && !mockOk) throw Object.assign(new Error('job URL must be https on transovo.ai'), { fatal: true, code: 'BAD_URL' });
  SECRET_STRINGS = [token, jobUrl];
  return { jobUrl, token };
}

export class HttpError extends Error { constructor(msg, status, body) { super(msg); this.status = status; this.body = body; } }

export function makeApi({ jobUrl, token, timeoutMs = Number(process.env.BG_DELIVERY_TIMEOUT_MS) || 60000 }) {
  return async function api(suffix, body, { method } = {}) {
    let res;
    try {
      res = await fetch(jobUrl + suffix, { method: method || (body ? 'POST' : 'GET'), redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
        headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    } catch (e) { throw new HttpError(`${suffix || '/'} network ${e?.name || 'error'}`, 0); }
    const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch {}
    if (!res.ok) throw new HttpError(`${suffix || '/'} HTTP ${res.status} ${redact(String(json?.error || json?.message || '').slice(0, 200))}`, res.status, json);
    return json;
  };
}

// Transient = network/timeouts, 408, 425, 429, 5xx. Everything else (400/401/403/404/409/413/422) is not retried here.
export const transient = e => !e || e.status === undefined || e.status === 0 || [408, 425, 429].includes(e.status) || e.status >= 500;

// Retry with exponential backoff + jitter until `deadline` (epoch ms). Non-transient errors throw at once.
export async function retryUntil(fn, { label = '', deadline, log = () => {}, baseMs = Number(process.env.BG_DELIVERY_BACKOFF_BASE_MS) || 2000, capMs = Number(process.env.BG_DELIVERY_BACKOFF_CAP_MS) || 300000 }) {
  for (let attempt = 0; ; attempt++) {
    try { return await fn(attempt); } catch (e) {
      if (!transient(e)) throw e;
      const wait = Math.min(capMs, baseMs * 2 ** Math.min(attempt, 16)) * (0.75 + Math.random() * 0.5);
      if (Date.now() + wait > deadline) { e.windowExhausted = true; throw e; }
      log(`retry ${label} #${attempt + 1} in ${Math.round(wait / 1000)}s: ${redact(e.message)}`);
      await sleep(wait);
    }
  }
}

// Storage upload for one prepared slot (signed_put | s3_multipart | tus). URLs are never logged.
async function put(url, init, timeoutMs) {
  let r; try { r = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) }); }
  catch (e) { throw new HttpError('storage network ' + (e?.name || 'error'), 0); }
  if (!r.ok) throw new HttpError('storage HTTP ' + r.status, r.status >= 500 || r.status === 429 || r.status === 408 ? r.status : 502);  // a refused PUT means a stale slot: re-prepare
  return r;
}
export async function uploadPrepared(prepared, buf, mime) {
  const t = Math.ceil(Math.max(Number(process.env.BG_DELIVERY_PUT_TIMEOUT_MS) || 120000, buf.length / 200));   // >=200 KB/s
  if (prepared.mode === 'signed_put' || (!prepared.mode && prepared.signedPut)) {
    await put(prepared.signedPut.url, { method: 'PUT', headers: { 'content-type': mime }, body: buf }, t); return [];
  }
  if (prepared.mode === 's3_multipart') {
    const { partSize, partUrls } = prepared.s3Multipart; const parts = [];
    if (partUrls.length !== Math.ceil(buf.length / partSize)) throw new Error('invalid part count');
    for (const { partNumber, url } of partUrls) {
      const from = (partNumber - 1) * partSize;
      const r = await put(url, { method: 'PUT', body: buf.subarray(from, from + partSize) }, t);
      const etag = r.headers.get('etag'); if (!etag) throw new HttpError('missing part etag', 502); parts.push({ partNumber, etag });
    }
    return parts;
  }
  if (prepared.mode === 'tus') {
    const { endpoint, token, bucket, objectKey } = prepared.tus;
    const headers = { 'Tus-Resumable': '1.0.0', 'x-signature': token };
    const metadata = Object.entries({ bucketName: bucket, objectName: objectKey, contentType: mime }).map(([k, v]) => k + ' ' + Buffer.from(v).toString('base64')).join(',');
    const created = await put(endpoint, { method: 'POST', headers: { ...headers, 'Upload-Length': String(buf.length), 'Upload-Metadata': metadata } }, t);
    const loc = created.headers.get('location'); if (!loc) throw new HttpError('missing upload location', 502);
    const target = new URL(loc, endpoint); if (target.origin !== new URL(endpoint).origin) throw new Error('unexpected upload origin');
    const chunk = 6 * 1024 * 1024;
    for (let off = 0; off < buf.length; off += chunk) {
      const end = Math.min(off + chunk, buf.length);
      const r = await put(target, { method: 'PATCH', headers: { ...headers, 'Upload-Offset': String(off), 'content-type': 'application/offset+octet-stream' }, body: buf.subarray(off, end) }, t);
      if (r.headers.get('upload-offset') !== String(end)) throw new HttpError('incomplete upload chunk', 502);
    }
    return [];
  }
  if (prepared.exists) return [];
  throw new Error('unsupported upload mode');
}

// Upload one file: prepare -> PUT -> commit (status ready). Returns the server upload id.
export async function uploadOne(api, { buf, kind, mime, filename, sha256 }) {
  const prepared = await api('/assets', { action: 'prepare', resume: true, kind, filename, mime, bytes: buf.length, sha256 });
  if (prepared.exists && prepared.uploadId) return prepared.uploadId;
  const parts = await uploadPrepared(prepared, buf, mime);
  const c = await api('/assets', { action: 'commit', uploadId: prepared.uploadId || prepared.assetId, ...(parts.length ? { parts } : {}) });
  if (c?.status !== 'ready') throw new HttpError('commit not confirmed for ' + filename, 502);
  return c.uploadId || prepared.uploadId;
}

export const receiptKey = a => JSON.stringify([a.sha256, a.kind, a.filename, a.bytes, a.mime]);

// Wire form of a package asset exactly as publish-live.mjs uploads it (kind/mime/filename rules).
export const wire = a => ({ ...a, mime: /^(text\/(html|x-python|x-shellscript|markdown|vtt))$/.test(a.mime) ? 'text/plain' : a.mime,
  kind: a.id.startsWith('bnd_') ? 'bundle' : a.id.startsWith('fnt_') ? 'font' : a.kind, filename: String(a.filename || a.id).slice(0, 150).replace(/[^a-zA-Z0-9._-]/g, '_') });

export function pidAlive(pid) { try { process.kill(pid, 0); return true; } catch { return false; } }

// Shared helpers: hashing, canonical JSON, fs, redaction, time.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const sha256File = (p) => new Promise((res, rej) => {
  const h = crypto.createHash('sha256'); fs.createReadStream(p).on('data', d => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej);
});
export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
// Canonical JSON: sorted keys, no whitespace. Used for content ids (bundle ids, props hashes).
export function canon(v) {
  if (v === undefined) return 'null';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
}
export const hashJson = (v) => sha256(Buffer.from(canon(v)));
export const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
export const writeJson = (p, v) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v, null, 1)); };
export const mkdirp = (p) => fs.mkdirSync(p, { recursive: true });
export const nowIso = () => new Date().toISOString();
// ET label for human logs
export const nowEt = () => new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false }).replace(',', '') + ' ET';
export function walk(dir, filter = () => true, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name); const rel = path.relative(base, p);
    if (e.isDirectory()) { if (filter(rel + '/', true)) out.push(...walk(p, filter, base)); }
    else if (e.isFile() && filter(rel, false)) out.push(rel);
  }
  return out;
}
// Never let signed URLs / tokens reach logs.
export const redact = (s) => String(s).replace(/([?&](sig|token|signature|X-Amz-[A-Za-z-]+)=)[^&\s"']+/g, '$1[redacted]').replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [redacted]');
export function run(cmd, args, opts = {}) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts }); let out = '', err = '';
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
    p.on('close', c => c === 0 ? res({ out, err, stdout: out, stderr: err }) : rej(new Error(`${cmd} exited ${c}: ${redact(err).slice(-2000)}`)));
  });
}
export const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
export function deepMerge(a, b) { // null deletes (patch semantics)
  if (!isObj(b)) return structuredClone(b);
  const o = isObj(a) ? structuredClone(a) : {};
  for (const k of Object.keys(b)) { if (b[k] === null) { delete o[k]; continue; } o[k] = isObj(b[k]) && isObj(o[k]) ? deepMerge(o[k], b[k]) : structuredClone(b[k]); }
  return o;
}
export const mimeOf = (p) => ({ '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttc': 'font/collection', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.html': 'text/html', '.css': 'text/css', '.py': 'text/x-python', '.sh': 'text/x-shellscript', '.md': 'text/markdown', '.txt': 'text/plain', '.srt': 'application/x-subrip', '.vtt': 'text/vtt', '.tflite': 'application/octet-stream' }[path.extname(p).toLowerCase()] || 'application/octet-stream');
export function ffprobe(p) {
  return run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,profile,level,width,height,r_frame_rate,nb_frames,pix_fmt:format=duration,size', '-of', 'json', p]).then(r => JSON.parse(r.out));
}

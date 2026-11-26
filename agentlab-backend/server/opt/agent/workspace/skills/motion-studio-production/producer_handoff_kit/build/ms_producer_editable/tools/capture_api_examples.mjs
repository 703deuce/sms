// Records real request/response pairs from the simulated Transovo API into docs/api-examples.md (tokens + signatures redacted,
// long arrays shortened). Uses its own project id "api_demo" so it never disturbs other state.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { CFG } from '../producer/lib/config.mjs';
const BASE = process.env.MS_API || 'http://127.0.0.1:8787/api/motion-studio'; const out = []; let TOK = null;
const red = s => s.replace(/(sig=)[a-f0-9]+/g, '$1<sig>').replace(/\/_scene\/(bnd_[a-f0-9]+)\/(\d+)\/[a-f0-9]{32}\//g, '/_scene/$1/<exp>/<sig>/').replace(/(Bearer )\S+/g, '$1<job token>').replace(/"jobToken":\s*"[^"]+"/g, '"jobToken": "<job token, shown once>"');
const short = (v, d = 0) => { if (Array.isArray(v)) { const a = v.slice(0, 3).map(x => short(x, d + 1)); if (v.length > 3) a.push(`… ${v.length - 3} more`); return a; }
  if (v && typeof v === 'object') { const o = {}; const ks = Object.keys(v); for (const k of ks.slice(0, d > 3 ? 6 : 40)) o[k] = short(v[k], d + 1); if (ks.length > (d > 3 ? 6 : 40)) o['…'] = `${ks.length - 6} more keys`; return o; } return typeof v === 'string' && v.length > 160 ? v.slice(0, 157) + '…' : v; };
async function call(title, method, p, body, { auth = true, raw = false, note } = {}) {
  const url = p.startsWith('http') ? p : BASE + p; const h = { 'Content-Type': 'application/json' }; if (auth && TOK) h.Authorization = 'Bearer ' + TOK;
  const r = await fetch(url, { method, headers: h, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t.slice(0, 200); }
  out.push(`### ${title}\n${note ? note + '\n' : ''}\n\`\`\`http\n${method} ${red(url.replace('http://127.0.0.1:8787', ''))}${auth && TOK ? '\nAuthorization: Bearer <job token>' : ''}${body !== undefined && !raw ? '\nContent-Type: application/json\n\n' + red(JSON.stringify(short(body), null, 1)) : raw ? '\n\n<' + body.length + ' raw bytes>' : ''}\n\`\`\`\n\`\`\`json\n${r.status}\n${red(JSON.stringify(short(j), null, 1))}\n\`\`\`\n`); return { status: r.status, j }; }
const j = await call('Create a job (Transovo-internal; the sim exposes it so tests can play Transovo)', 'POST', '/_sim/jobs', { projectId: 'api_demo', mode: 'deterministic_render', action: 'deterministic_render', workerId: 'wrk_grokbot_A', input: { schema: 'transovo.motion-job/1', mode: 'deterministic_render', projectId: 'api_demo', baseVersion: 1, edits: { schema: 'transovo.edit-patch/1', scenes: { S01: { elements: { location: { text: 'Central Islip, New York' } } } } } } }, { auth: false });
TOK = j.j.jobToken; const jobId = j.j.jobId;
await call('Read the job (worker, first call after the webhook)', 'GET', `/agent/jobs/${jobId}`);
const buf = fs.readFileSync(path.join(CFG.root, 'tests/assets/logo_mark.svg')); const sha = crypto.createHash('sha256').update(buf).digest('hex');
await call('Asset lookup by sha256 (dedupe before upload)', 'POST', '/assets/lookup', { sha256: [sha, '0'.repeat(64)] });
const prep = await call('Upload step 1: prepare', 'POST', '/assets', { action: 'prepare', filename: 'logo_mark.svg', kind: 'image', mime: 'image/svg+xml', bytes: buf.length, sha256: sha, meta: { width: 600, height: 200, svgSafe: true } });
if (prep.j.signedPut) { await call('Upload step 2: PUT bytes to the signed URL (no bearer; the signature is the capability)', 'PUT', prep.j.signedPut.url, buf, { auth: false, raw: true });
  await call('Upload step 3: commit (server re-hashes; 422 integrity_mismatch on any difference)', 'POST', '/assets', { action: 'commit', uploadId: prep.j.uploadId }); }
await call('Prepare again with the same bytes: content-addressed dedupe', 'POST', '/assets', { action: 'prepare', filename: 'copy.svg', kind: 'image', mime: 'image/svg+xml', bytes: buf.length, sha256: sha });
await call('Asset info + short-lived download URL', 'GET', '/assets/ast_' + sha.slice(0, 32));
await call('List versions (head = 0 for a new project)', 'GET', '/projects/api_demo/versions');
// publish a v1 for the demo project: a copy of the Keith v1 document (assets already in storage)
const rj = await (await fetch(BASE + '/_sim/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: 'km_doc_2min', mode: 'read' }) })).json();
const kdoc = await (await fetch(BASE + '/projects/km_doc_2min/versions/1', { headers: { Authorization: 'Bearer ' + rj.jobToken } })).json();
const doc = { ...kdoc, projectId: 'api_demo', version: 1, parentVersion: null };
await call('Publish version 1 (write-once; body = full transovo.motion-project/1 document)', 'POST', '/projects/api_demo/versions', { baseVersion: 0, document: doc });
await call('Publish on a stale base → 409', 'POST', '/projects/api_demo/versions', { baseVersion: 0, document: doc });
await call('Read a version', 'GET', '/projects/api_demo/versions/1');
await call('Editor: open a live preview session for one scene', 'POST', '/projects/api_demo/versions/1/scenes/S01/session', {});
await call('Editor: records + signed URLs for a font / logo the user just picked', 'POST', '/projects/api_demo/preview-assets', { ids: ['fnt_97aae409210d255fb3b92f18c8af2ed1', 'ast_' + sha.slice(0, 32)] });
await call('Engine font catalog (browser)', 'GET', '/fonts/catalog/browser');
await call('Progress', 'POST', `/agent/jobs/${jobId}/progress`, { phase: 'render', progress: 40, message: 'rendering S01' });
await call('Event: dependencies', 'POST', `/agent/jobs/${jobId}/events`, { at: new Date().toISOString(), type: 'stage', stage: 'dependencies', data: { scenes: [{ sceneId: 'S01', rerender: true, reason: 'resolved props changed: elements.location.text' }, { sceneId: 'S02', rerender: false, reason: 'unchanged: identical render key, clip reused' }], master: { reassemble: true, reason: 'segments changed: S01' } } });
await call('Event: artifact', 'POST', `/agent/jobs/${jobId}/events`, { at: new Date().toISOString(), type: 'artifact', artifact: { assetId: 'ast_' + sha.slice(0, 32), role: 'scene_clip', sceneId: 'S01', sha256: sha } });
await call('Checkpoint (monotonic revision; resume skips done scenes)', 'PUT', `/agent/jobs/${jobId}/checkpoint`, { revision: 1, checkpoint: { stage: 'scenes', done: { S01: { renderKey: 'rk_…', clip: { asset: 'ast_…' } } } } });
await call('Stale checkpoint → 409', 'PUT', `/agent/jobs/${jobId}/checkpoint`, { revision: 1, checkpoint: {} });
await call('Read checkpoint (on resume)', 'GET', `/agent/jobs/${jobId}/checkpoint`);
await call('Worker registration', 'PUT', '/workers/wrk_demo', { schema: 'transovo.worker/1', workerId: 'wrk_demo', machineId: 'mch_…', planId: 'plan_grok_shared_01', modes: ['deterministic_render'], wakeup: { type: 'webhook_routine', routineId: 'rtn_…' }, capabilities: { schema: 'transovo.capabilities/1', engines: { browser: { ok: true } } }, softwareVersion: 'ms-producer 1.0.0' });
await call('Usage report', 'POST', '/workers/wrk_demo/usage', { schema: 'transovo.usage/1', workerId: 'wrk_demo', machineId: 'mch_…', planId: 'plan_grok_shared_01', jobId, mode: 'deterministic_render', before: { at: '…' }, after: { at: '…' }, renderDurationMs: 61234, wallMs: 74000, aiCalls: 0, status: 'completed', failures: [] });
await call('Complete', 'POST', `/agent/jobs/${jobId}/complete`, { status: 'completed', projectVersion: 2, rerendered: ['S01'], masterReassembled: true });
await call('Any write after completion → 409', 'POST', `/agent/jobs/${jobId}/progress`, { phase: 'x', progress: 1 });
await call('Token of another project → 403', 'GET', '/projects/km_doc_2min/versions/1');
fs.writeFileSync(path.join(CFG.root, 'docs/api-examples.md'), `# Transovo API: recorded request/response examples\n\nRecorded from the simulator (\`sim/transovo-sim.mjs\`) by \`tools/capture_api_examples.mjs\` on ${new Date().toISOString()}. Tokens and URL signatures are redacted. Long arrays are shortened.\n\n` + out.join('\n'));
console.log('wrote', out.length, 'examples');

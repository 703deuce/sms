// shared test helpers. Tests talk to the simulated Transovo server only (never the real job API).
import fs from 'node:fs'; import path from 'node:path'; import { StoreClient } from '../producer/lib/store-client.mjs';
import { run, readJson, writeJson, mkdirp } from '../producer/lib/util.mjs'; import { CFG } from '../producer/lib/config.mjs';
export const API = process.env.MS_API || 'http://127.0.0.1:8787/api/motion-studio';
export const OUT = path.join(CFG.root, 'out/tests'); mkdirp(OUT);
export async function simJob(projectId, mode, input, workerId) { const r = await fetch(API + '/_sim/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, mode, action: input?.action || mode, input, workerId }) }); return r.json(); }
export async function storeFor(projectId) { const j = await simJob(projectId, 'read', {}); return { store: new StoreClient({ apiBase: j.apiBase, jobToken: j.jobToken }), job: j }; }
export const workerA = { workerId: 'wrk_grokbot_A', planId: 'plan_grok_shared_01', account: { handle: 'acct_rick_grok' }, routineId: 'rtn_webhook_A', modes: ['deterministic_render', 'creative_production'], cacheDir: path.join(CFG.root, 'out/workerA/cache'), workDir: path.join(CFG.root, 'out/workerA/work') };
// SSIM / PSNR between two videos (optionally a frame range of b)
export async function compare(a, b, { aTrim, bTrim } = {}) {
  const tr = t => t ? `trim=start_frame=${t[0]}:end_frame=${t[1]},setpts=PTS-STARTPTS,` : '';
  const r = await run('ffmpeg', ['-v', 'info', '-i', a, '-i', b, '-lavfi', `[0:v]${tr(aTrim)}format=yuv420p[x];[1:v]${tr(bTrim)}format=yuv420p[y];[x][y]ssim;[0:v]${tr(aTrim)}format=yuv420p[p];[1:v]${tr(bTrim)}format=yuv420p[q];[p][q]psnr`.replace(/;\[0:v\].*$/, ''), '-f', 'null', '-']).catch(e => ({ err: e.message }));
  const s = /All:([\d.]+)/.exec(r.err || ''); const r2 = await run('ffmpeg', ['-v', 'info', '-i', a, '-i', b, '-lavfi', `[0:v]${tr(aTrim)}format=yuv420p[x];[1:v]${tr(bTrim)}format=yuv420p[y];[x][y]psnr`, '-f', 'null', '-']).catch(e => ({ err: e.message }));
  const p = /average:([\d.inf]+)/.exec(r2.err || ''); return { ssim: s ? +s[1] : null, psnr: p ? (p[1] === 'inf' ? Infinity : +p[1]) : null };
}
export async function frameAt(video, frame, out) { await run('ffmpeg', ['-y', '-v', 'error', '-i', video, '-vf', `select=eq(n\\,${frame})`, '-frames:v', '1', out]); return out; }
export async function sheet(tiles, out, { cols = 3, w = 640, label = true } = {}) { // tiles: [{img, label}]
  const args = ['-y', '-v', 'error']; tiles.forEach(t => args.push('-i', t.img)); const f = tiles.map((t, i) => `[${i}:v]scale=${w}:-2,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='${t.label.replace(/[':\\]/g, ' ')}':x=10:y=10:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.6[t${i}]`).join(';');
  const rows = Math.ceil(tiles.length / cols); const layout = tiles.map((_, i) => `${(i % cols) ? Array.from({ length: i % cols }, (_, k) => `w${k}`).join('+') : '0'}_${Math.floor(i / cols) ? Array.from({ length: Math.floor(i / cols) }, (_, k) => `h${k * cols}`).join('+') : '0'}`).join('|');
  args.push('-filter_complex', `${f};${tiles.map((_, i) => `[t${i}]`).join('')}xstack=inputs=${tiles.length}:layout=${layout}:fill=black[o]`, '-map', '[o]', '-frames:v', '1', out); await run('ffmpeg', args); return out; }
export const results = []; export function record(id, name, pass, details) { results.push({ id, name, pass, details }); console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${name} ${JSON.stringify(details).slice(0, 400)}`); }

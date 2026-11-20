// worker.mjs: one Grokbot worker. Transovo schedules; a webhook routine wakes the worker with ONE job (jobId + job token).
// The worker never polls for work, never picks jobs, never schedules others. It reports identity, capabilities, progress,
// checkpoints, artifacts, errors and usage (before/after, timestamps, render duration, failures).
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import crypto from 'node:crypto';
import { StoreClient } from './store-client.mjs'; import { deterministicRender, JobRejected } from './render-job.mjs';
import { runtimeLock } from './runtime-lock.mjs'; import { nowIso, redact, mkdirp, writeJson } from './util.mjs'; import { CFG } from './config.mjs';
export const SOFTWARE_VERSION = 'ms-producer 1.0.0';
export function machineId() { let mid = ''; try { mid = fs.readFileSync('/etc/machine-id', 'utf8').trim(); } catch { mid = os.hostname(); } return 'mch_' + crypto.createHash('sha256').update('transovo-machine:' + mid).digest('hex').slice(0, 20); }
function procTimes() { try { const f = fs.readFileSync('/proc/self/stat', 'utf8').split(') ')[1].split(' '); const hz = 100; return { userMs: +f[11] * 1000 / hz, sysMs: +f[12] * 1000 / hz, childUserMs: +f[13] * 1000 / hz, childSysMs: +f[14] * 1000 / hz }; } catch { return null; } }
function dirBytes(d) { let n = 0; try { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); n += e.isDirectory() ? dirBytes(p) : fs.statSync(p).size; } } catch { } return n; }
// Plan usage comes from the waking routine (CheckSubscriptionUsage on the agent side); the worker process cannot read it.
// Accepts {usedPercent|percent, window, observedAt|at, resetsAt, source}; anything else is dropped (no free-form passthrough).
export const PLAN_USAGE_STALE_SEC = 900;
export function normalizePlanUsage(pu, cfg = {}) {
  if (!pu || typeof pu !== 'object') return { available: false, note: 'Grok plan usage is read by the waking routine (agent side) and passed in with --plan-usage-before/--plan-usage-after' };
  const pct = pu.usedPercent ?? pu.percent; const obs = pu.observedAt || pu.at || null; const iso = v => (typeof v === 'string' && !isNaN(Date.parse(v))) ? new Date(v).toISOString() : null;
  const o = { available: typeof pct === 'number' && pct >= 0 && pct <= 100, window: ['weekly', 'daily', 'monthly'].includes(pu.window) ? pu.window : (typeof pct === 'number' ? 'weekly' : 'unknown'),
    observedAt: iso(obs), resetsAt: iso(pu.resetsAt), source: typeof pu.source === 'string' ? pu.source.slice(0, 64) : 'routine', planId: cfg.planId || null };
  if (o.available) o.usedPercent = Math.round(pct * 100) / 100; else o.note = typeof pu.note === 'string' ? pu.note.slice(0, 200) : 'no usage percentage supplied';
  if (o.observedAt) { o.ageSec = Math.max(0, Math.round((Date.now() - Date.parse(o.observedAt)) / 1000)); o.stale = o.ageSec > PLAN_USAGE_STALE_SEC; }
  return o; }
export function planUsageDelta(b, a) { if (!b?.available || !a?.available) return null;
  const resetBetween = !!(b.resetsAt && a.observedAt && Date.parse(a.observedAt) >= Date.parse(b.resetsAt)) || a.usedPercent < b.usedPercent;
  return { percent: resetBetween ? null : Math.round((a.usedPercent - b.usedPercent) * 100) / 100, resetBetween }; }
export function machineCapacity(cfg = {}) { const c = os.cpus(); const memTotalMb = Math.round(os.totalmem() / 1048576);
  return { cpus: c.length, cpuModel: (c[0] && c[0].model || '').slice(0, 80), memTotalMb, gpu: 'none (SwiftShader software WebGL)', renderSlots: cfg.renderSlots || Math.max(1, Math.min(2, Math.floor(memTotalMb / 7000))) }; }
export function snapshot(cfg, planUsage) { const st = fs.statfsSync ? fs.statfsSync(cfg.cacheDir) : null;
  return { at: nowIso(), cpu: procTimes(), maxRssKb: process.resourceUsage().maxRSS, loadavg: os.loadavg().map(x => +x.toFixed(2)), memFreeMb: Math.round(os.freemem() / 1048576),
    diskFreeMb: st ? Math.round(st.bavail * st.bsize / 1048576) : null, cacheMb: Math.round(dirBytes(cfg.cacheDir) / 1048576), aiCallsTotal: 0,
    planUsage: normalizePlanUsage(planUsage, cfg) }; }
export async function capabilities(cfg) { const lock = await runtimeLock();
  const fontsDir = path.join(cfg.cacheDir, 'font-index.json'); let fontCounts = null; try { const idx = JSON.parse(fs.readFileSync(fontsDir, 'utf8')); fontCounts = {}; for (const f of idx.fonts) for (const [e, v] of Object.entries(f.engines || {})) if (v.ok) fontCounts[e] = (fontCounts[e] || 0) + 1; } catch { }
  return { schema: 'transovo.capabilities/1', modes: cfg.modes || ['deterministic_render'], engines: {
      browser: { ok: !!lock.chrome, chrome: lock.chrome, webgl: 'SwiftShader (software)', libraries: ['three.js', 'gsap', 'pixi.js', 'd3', 'canvaskit'], livePreviewRuntime: 'ms-props 1' },
      python: { ok: !!lock.python, version: lock.python, packages: lock.pythonPackages }, ffmpeg: { ok: !!lock.ffmpeg, version: lock.ffmpeg, encoders: ['libx264 High@4.2', 'prores_ks 4444', 'aac'] },
      mediapipe: { ok: fs.existsSync('/workspace/motion_engines/mediapipe/models/blaze_face_short_range.tflite'), use: 'portrait.autoFocalPoint' } },
    fontEngines: fontCounts, limits: { maxConcurrentJobs: cfg.maxConcurrentJobs || 1, maxResolution: '1920x1080 / 1080x1920' }, runtimeLock: lock }; }
export async function register(cfg, apiBase, tok) {
  const store = new StoreClient({ apiBase, jobToken: tok || 'none' });
  const reg = { schema: 'transovo.worker/1', workerId: cfg.workerId, machineId: machineId(), planId: cfg.planId, account: cfg.account || null, modes: cfg.modes || ['deterministic_render'],
    capabilities: await capabilities(cfg), wakeup: { type: 'webhook_routine', routineId: cfg.routineId || null }, softwareVersion: SOFTWARE_VERSION, machine: machineCapacity(cfg), activeJob: null, registeredAt: nowIso() };
  await store.registerWorker(cfg.workerId, reg); return reg;
}
/** run exactly one job that Transovo assigned. cfg: {workerId, planId, cacheDir, workDir, modes} */
export async function runJob({ apiBase, jobId, jobToken, cfg, planUsageBefore, planUsageAfterFn }) {
  const store = new StoreClient({ apiBase, jobToken }); mkdirp(cfg.cacheDir); const workDir = path.join(cfg.workDir, jobId); mkdirp(workDir);
  const before = snapshot(cfg, planUsageBefore); const t0 = Date.now(); const failures = []; let status = 'completed', result = null;
  const emit = (ev) => store.event(jobId, ev).catch(e => console.error('event failed', redact(e.message)));
  const progress = (phase, p, message) => store.progress(jobId, phase, p, message).catch(() => {});
  const { job } = await store.job(jobId);
  const hb = (activeJob, extra = {}) => store.heartbeat(cfg.workerId, { schema: 'transovo.worker-heartbeat/1', workerId: cfg.workerId, machineId: machineId(), planId: cfg.planId, at: nowIso(), activeJob, ...extra }).catch(() => {});
  await hb({ jobId, mode: job.mode, projectId: job.projectId, status: 'running', startedAt: before.at });
  await emit({ type: 'stage', stage: 'accepted', message: `worker ${cfg.workerId} on ${machineId()} (plan ${cfg.planId}) accepted ${job.mode}`, data: { workerId: cfg.workerId, machineId: machineId(), planId: cfg.planId } });
  try {
    if (!(cfg.modes || ['deterministic_render']).includes(job.mode)) throw new JobRejected([{ severity: 'error', code: 'MODE_NOT_SUPPORTED', message: `worker ${cfg.workerId} does not run ${job.mode}` }], 'input');
    if (job.mode === 'deterministic_render') result = await deterministicRender({ store, jobId, input: job.input, worker: cfg, cacheDir: cfg.cacheDir, workDir, emit, progress });
    else if (job.mode === 'creative_production') result = await creativeHandoff({ store, jobId, job, cfg, workDir, emit });
    else throw new JobRejected([{ severity: 'error', code: 'UNKNOWN_MODE', message: String(job.mode) }], 'input');
  } catch (e) {
    if (e instanceof JobRejected) { status = 'rejected'; failures.push({ stage: e.stage, issues: e.issues.filter(i => i.severity === 'error') }); await emit({ type: 'validation', stage: e.stage, issues: e.issues, message: 'rejected; base version untouched' }); }
    else { status = 'failed'; failures.push({ stage: 'run', message: redact(e.message).slice(0, 1500) }); await emit({ type: 'error', message: redact(e.message).slice(0, 1500) }); }
  }
  const after = snapshot(cfg, planUsageAfterFn ? await planUsageAfterFn() : undefined);
  const usage = { schema: 'transovo.usage/1', workerId: cfg.workerId, machineId: machineId(), planId: cfg.planId, jobId, mode: job.mode, projectId: job.projectId, startedAt: before.at, finishedAt: after.at, before, after, planUsageDelta: planUsageDelta(before.planUsage, after.planUsage),
    renderDurationMs: Math.round((result && result.timings ? result.timings.renderMs + result.timings.assembleMs : 0)), wallMs: Date.now() - t0, aiCalls: 0, status, failures };
  await store.usage(cfg.workerId, usage).catch(e => console.error('usage report failed', redact(e.message)));
  const summary = status === 'completed' ? { status: 'completed', projectVersion: result.version, rerendered: result.dependencies?.scenes.filter(s => s.rerender).map(s => s.sceneId), masterReassembled: !!result.masterOut, dryRun: !!result.dryRun, handoff: result.handoff || null, previewStills: result.stills || null }
    : { status: 'failed', reason: status === 'rejected' ? 'validation_rejected' : 'error', failures };
  await store.complete(jobId, summary);
  await hb(null, { lastJob: { jobId, status, finishedAt: after.at, renderDurationMs: usage.renderDurationMs } });
  writeJson(path.join(workDir, 'job-result.json'), { summary, usage, dependencies: result && result.dependencies, issues: result ? result.issues : failures });
  return { status, summary, usage, result };
}
// creative_production: AI work runs in the Grokbot production skill session (unchanged). The worker only records the brief
// as an untrusted input, hands off, and never mixes AI steps into the deterministic pipeline.
async function creativeHandoff({ store, jobId, job, cfg, workDir, emit }) {
  const h = { schema: 'transovo.creative-handoff/1', jobId, projectId: job.projectId, baseVersion: job.input.baseVersion ?? null, brief: { untrusted: true, text: String(job.input.brief || '').slice(0, 4000) },
    rules: ['publish results as a new project version through the same storage API', 'every new scene ships an editable-elements manifest + bundle', 'no deterministic job may depend on AI output that is not stored as an asset'], createdAt: nowIso() };
  writeJson(path.join(workDir, 'creative-handoff.json'), h);
  await emit({ type: 'stage', stage: 'creative_handoff', message: 'creative_production is executed by the production skill session; handoff recorded', data: { handoffFile: 'creative-handoff.json' } });
  return { handoff: 'creative-handoff.json', version: null };
}

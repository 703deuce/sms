// Milestone: Keith S01 text + full theme change -> deterministic render (no AI) -> v2, through runJob on worker A.
import { simJob, workerA, storeFor, OUT } from './lib.mjs'; import { runJob, register } from '../producer/lib/worker.mjs'; import { writeJson } from '../producer/lib/util.mjs'; import path from 'node:path';
export const KEITH_THEME = { colors: { background: { value: '#1B0E2E' }, primary: { value: '#2C1A4A' }, secondary: { value: '#E0A030' }, accent: { value: '#4FD1C5' }, text: { value: '#F4EEE0' } },
  fonts: { display: { faces: ['fnt_97aae409210d255fb3b92f18c8af2ed1'], weight: 400, label: 'Anton 400' }, label: { faces: ['fnt_731d3a8cf6b598adff0d8096747a7442'], weight: 400, label: 'Oswald' },
    body: { faces: ['fnt_bbe1e33dfabbfe69b97564724bf76391', 'fnt_fbbdabe510e6c0d94d1b0c67640d375b'], weight: 400, label: 'Source Serif Pro + Italic' } } };
export const KEITH_EDITS = { schema: 'transovo.edit-patch/1', theme: KEITH_THEME, scenes: { S01: { elements: { location: { text: 'Central Islip, New York' }, title: { text: 'Keith\nMurray' } } } } };
if (import.meta.url === `file://${process.argv[1]}`) {
  const dry = process.argv.includes('--dry'); const pid = 'km_doc_2min'; const { store } = await storeFor(pid); const headBefore = (await store.listVersions(pid)).head;
  const j = await simJob(pid, 'deterministic_render', { schema: 'transovo.motion-job/1', mode: 'deterministic_render', projectId: pid, baseVersion: headBefore, edits: KEITH_EDITS, dryRun: dry }, workerA.workerId);
  await register(workerA, j.apiBase, j.jobToken);
  const t0 = Date.now(); const r = await runJob({ apiBase: j.apiBase, jobId: j.jobId, jobToken: j.jobToken, cfg: workerA, planUsageBefore: { source: 'test', note: 'routine passes CheckSubscriptionUsage snapshot' } });
  const out = { jobId: j.jobId, headBefore, headAfter: (await store.listVersions(pid)).head, wallMs: Date.now() - t0, status: r.status, summary: r.summary, deps: r.result?.dependencies, issues: (r.result?.issues || r.summary.failures), masterOut: r.result?.masterOut, rendered: r.result && Object.fromEntries(Object.entries(r.result.rendered || {}).map(([k, v]) => [k, v.out])) };
  writeJson(path.join(OUT, dry ? 'milestone_keith_dry.json' : 'milestone_keith.json'), out); console.log(JSON.stringify(out, null, 1).slice(0, 6000));
}

// Stage 6/10: a second, clean worker. Separate home dir, separate uid (2000) and hostname inside a bubblewrap sandbox, software
// installed from a release tarball (no fixtures, no tests, no out/), NO access to /workspace/ms_producer_editable,
// /workspace/motion_tests or worker A's cache. It reconstructs the project purely from storage (asset ids) and renders a revision.
import fs from 'node:fs'; import path from 'node:path'; import { spawn } from 'node:child_process';
import { simJob, OUT } from './lib.mjs'; import { CFG } from '../producer/lib/config.mjs'; import { run, writeJson } from '../producer/lib/util.mjs';
export const WB = '/workspace/ms_workerB';              // worker B's own machine-local dir (outside the producer repo)
const HOME_IN = '/home/workerb';
export async function installWorkerB() {
  fs.rmSync(WB, { recursive: true, force: true }); fs.mkdirSync(path.join(WB, 'home'), { recursive: true }); fs.mkdirSync(path.join(OUT, 'release'), { recursive: true });
  const tgz = path.join(OUT, 'release', 'ms-producer-1.0.0.tgz');
  await run('tar', ['-czf', tgz, '-C', CFG.root, 'package.json', 'package-lock.json', 'producer', 'schemas', 'node_modules']);
  fs.mkdirSync(path.join(WB, 'home', 'app')); await run('tar', ['-xzf', tgz, '-C', path.join(WB, 'home', 'app')]);
  return { tgz, bytes: fs.statSync(tgz).size };
}
function bwrapArgs() { const ro = p => ['--ro-bind', p, p]; const uvPy = '/home/box/.local/share/uv/python';
  return ['--unshare-user', '--uid', '2000', '--gid', '2000', '--unshare-uts', '--hostname', 'grokbot-worker-b', '--unshare-ipc', '--unshare-pid', '--die-with-parent',
    ...ro('/usr'), '--symlink', 'usr/bin', '/bin', '--symlink', 'usr/sbin', '/sbin', '--symlink', 'usr/lib', '/lib', '--symlink', 'usr/lib64', '/lib64',
    ...ro('/etc'), ...ro('/opt/google'), '--proc', '/proc', '--dev', '/dev', '--tmpfs', '/dev/shm', '--tmpfs', '/tmp',
    ...ro('/workspace/motion_prod_env'), ...ro('/workspace/motion_engines/mediapipe/venv'), ...ro('/workspace/motion_engines/mediapipe/models'), ...(fs.existsSync(uvPy) ? ro(uvPy) : []),
    '--bind', path.join(WB, 'home'), HOME_IN, '--chdir', HOME_IN, '--setenv', 'HOME', HOME_IN, '--setenv', 'PATH', '/usr/local/bin:/usr/bin:/bin', '--unsetenv', 'MS_WORK_DIR'];
}
export function inWorkerB(cmd, { log } = {}) { return new Promise((res) => { const p = spawn('bwrap', [...bwrapArgs(), '/bin/bash', '-c', cmd], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = ''; p.stdout.on('data', d => { out += d; if (log) fs.appendFileSync(log, d); }); p.stderr.on('data', d => { err += d; if (log) fs.appendFileSync(log, d); }); p.on('close', code => res({ code, out, err })); }); }
export const workerBConfig = { workerId: 'wrk_grokbot_B', planId: 'plan_grok_shared_01', account: { handle: 'acct_rick_grok' }, routineId: 'rtn_webhook_B', modes: ['deterministic_render'],
  cacheDir: HOME_IN + '/cache', workDir: HOME_IN + '/work' };
// one job, end to end, as the webhook routine would run it on worker B
export async function runOnWorkerB(projectId, input, tag) {
  const j = await simJob(projectId, 'deterministic_render', { schema: 'transovo.motion-job/1', mode: 'deterministic_render', projectId, ...input }, workerBConfig.workerId);
  fs.writeFileSync(path.join(WB, 'home', 'worker.json'), JSON.stringify(workerBConfig, null, 1)); fs.writeFileSync(path.join(WB, 'home', `${tag}.token`), j.jobToken, { mode: 0o600 });
  // fixture values standing in for what the waking routine reads with CheckSubscriptionUsage (shared plan, weekly window)
  const obs = { usedPercent: 37.2, window: 'weekly', observedAt: new Date().toISOString(), resetsAt: '2026-11-23T05:00:00Z', source: 'test-fixture (routine passes CheckSubscriptionUsage)' };
  fs.writeFileSync(path.join(WB, 'home', `${tag}.usage_before.json`), JSON.stringify(obs));
  fs.writeFileSync(path.join(WB, 'home', `${tag}.usage_after.json`), JSON.stringify({ ...obs, observedAt: new Date(Date.now() + 1000).toISOString() })); // deterministic job: no AI, so the routine sees the same %
  const log = path.join(OUT, `workerB_${tag}.log`); fs.writeFileSync(log, '');
  const cmd = `set -e; echo "[worker-b] uid=$(id -u) host=$(hostname)"; for p in /workspace/ms_producer_editable /workspace/motion_tests /workspace/editable_contract_poc /workspace/secrets /home/box/agent-data /workspace/ms_producer_editable/out/workerA; do [ -e "$p" ] && echo "[worker-b] VISIBLE $p" || echo "[worker-b] not visible: $p"; done
    cd ${HOME_IN}/app && node producer/bin/msp.mjs register --config ${HOME_IN}/worker.json --api ${j.apiBase} --token-file ${HOME_IN}/${tag}.token > ${HOME_IN}/register.json
    node producer/bin/msp.mjs run-job --config ${HOME_IN}/worker.json --api ${j.apiBase} --job ${j.jobId} --token-file ${HOME_IN}/${tag}.token --plan-usage-before ${HOME_IN}/${tag}.usage_before.json --plan-usage-after ${HOME_IN}/${tag}.usage_after.json
    rm -f ${HOME_IN}/${tag}.token`;
  const t0 = Date.now(); const r = await inWorkerB(cmd, { log });
  // no local path of the original install may appear anywhere in worker B's state
  const leak = await run('bash', ['-c', `grep -rIl -e /workspace/ms_producer_editable -e /workspace/motion_tests ${WB}/home/work ${WB}/home/cache 2>/dev/null | head -5 || true`]);
  const res = { jobId: j.jobId, exit: r.code, wallMs: Date.now() - t0, visibility: r.out.split('\n').filter(l => l.startsWith('[worker-b]')), summary: (r.out.trim().split('\n').filter(l => l.startsWith('{')).pop()) || null, stderrTail: r.err.slice(-1500), localPathLeaks: leak.out.trim().split('\n').filter(Boolean) };
  try { res.summary = JSON.parse(res.summary); } catch { }
  return res;
}

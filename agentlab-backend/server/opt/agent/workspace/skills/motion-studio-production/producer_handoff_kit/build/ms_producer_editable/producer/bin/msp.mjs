#!/usr/bin/env node
// msp: Motion Studio producer CLI (worker side).
//   msp register   --config worker.json --api <apiBase>
//   msp run-job    --config worker.json --api <apiBase> --job <jobId> --token-file <file> [--plan-usage-before f.json --plan-usage-after f.json]
//   msp export     --api <apiBase> --token-file <f> --project <pid> --version <n> --out <dir>     (portable package directory)
//   msp import-pkg --api <apiBase> --token-file <f> --dir <dir>                                   (load a package into a store)
import fs from 'node:fs'; import path from 'node:path';
import { register, runJob } from '../lib/worker.mjs'; import { exportPackage, importPackage } from '../lib/portable.mjs'; import { StoreClient } from '../lib/store-client.mjs';
const [cmd, ...rest] = process.argv.slice(2);
const a = Object.fromEntries(rest.reduce((acc, v, i, r) => (v.startsWith('--') && acc.push([v.slice(2), r[i + 1] && !r[i + 1].startsWith('--') ? r[i + 1] : true]), acc), []));
const cfg = a.config ? JSON.parse(fs.readFileSync(a.config, 'utf8')) : null; const tok = a['token-file'] ? fs.readFileSync(a['token-file'], 'utf8').trim() : null;
const readOpt = f => f ? JSON.parse(fs.readFileSync(f, 'utf8')) : undefined;
if (cmd === 'register') console.log(JSON.stringify(await register(cfg, a.api, tok), (k, v) => k === 'runtimeLock' ? '[lock]' : v, 1));
else if (cmd === 'run-job') { const r = await runJob({ apiBase: a.api, jobId: a.job, jobToken: tok, cfg, planUsageBefore: readOpt(a['plan-usage-before']), planUsageAfterFn: a['plan-usage-after'] ? async () => readOpt(a['plan-usage-after']) : undefined }); console.log(JSON.stringify(r.summary)); process.exit(r.status === 'failed' ? 1 : 0); }
else if (cmd === 'export') console.log(JSON.stringify(await exportPackage(new StoreClient({ apiBase: a.api, jobToken: tok }), a.project, Number(a.version), a.out)));
else if (cmd === 'import-pkg') console.log(JSON.stringify(await importPackage(new StoreClient({ apiBase: a.api, jobToken: tok }), a.dir)));
else { console.error('usage: msp register|run-job|export|import-pkg ...'); process.exit(2); }

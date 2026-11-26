#!/usr/bin/env node
// Report a coordinator lease status + optional Grok weekly usage to Transovo.
// Usage: node coord-report.mjs --job <jobId> --lease-file <file with leaseId> --status running|complete|failed
//          [--usage <percent>] [--moment before|after] [--resets-at <ISO>]
// Worker id/token come from /workspace/secrets/motion_runner.env. Never prints secrets or URLs.
import fs from 'node:fs'
const a = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) => (v.startsWith('--') ? acc.concat([[v.slice(2), arr[i + 1]]]) : acc), []))
const env = Object.fromEntries(fs.readFileSync('/workspace/secrets/motion_runner.env', 'utf8').split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]))
const origin = env.MOTION_STUDIO_AGENT_PUBLIC_URL
if (origin.replace(/\/$/, '') !== 'https://transovo.ai') { console.error('untrusted origin'); process.exit(4) }
const leaseId = a['lease-file'] ? fs.readFileSync(a['lease-file'], 'utf8').trim() : a.lease
const body = { workerId: env.MOTION_STUDIO_WORKER_ID, jobId: a.job, leaseId, status: a.status || 'running' }
if (a.usage !== undefined) { body.weeklyUsagePercent = Number(a.usage); body.usageMoment = a.moment === 'before' ? 'before' : 'after'; body.observedAt = new Date().toISOString(); if (a['resets-at']) body.resetsAt = a['resets-at'] }
const r = await fetch(new URL('/api/motion-studio/agent/coordinator/report', origin), { method: 'POST', redirect: 'error', headers: { authorization: 'Bearer ' + env.MOTION_STUDIO_WORKER_TOKEN, 'content-type': 'application/json' }, body: JSON.stringify(body) })
console.log('coordinator report', body.status, body.usageMoment || '', '-> HTTP', r.status)
if (!r.ok) process.exit(1)

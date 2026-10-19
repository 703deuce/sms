#!/usr/bin/env node
/**
 * Phone product API smoke (run against local dev or production base URL).
 * Usage: PHONE_TEST_BASE_URL=https://transovo.ai node new-app/scripts/test-phone-complete.mjs
 */
const base = process.env.PHONE_TEST_BASE_URL || 'http://localhost:3100'

async function get(path) {
  const res = await fetch(`${base}${path}`)
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, json }
}

async function main() {
  const checks = []
  const push = (name, ok) => checks.push([name, ok])

  push('readiness', (await get('/api/phone/readiness')).ok)
  push('settings', (await get('/api/phone/settings')).ok)
  push('calls', (await get('/api/phone/calls?limit=1')).ok)
  push('routing', (await get('/api/phone/routing')).ok)
  push('business hours', (await get('/api/phone/routing?part=hours')).ok)
  push('analytics', (await get('/api/phone/analytics?range=7d')).ok)
  push('webrtc token', (await get('/api/phone/webrtc-token')).ok)
  push('transfer targets', (await get('/api/phone/transfer-targets')).ok)
  push('power campaigns', (await get('/api/phone/power-dialer/campaigns')).ok)
  push('power lists', (await get('/api/phone/power-dialer/lists')).ok)

  let failed = 0
  for (const [name, pass] of checks) {
    console.log(pass ? 'PASS' : 'FAIL', name)
    if (!pass) failed++
  }
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

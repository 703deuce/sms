#!/usr/bin/env node
/**
 * Smoke tests for Phone APIs (requires DATABASE_URL and running `next dev` on port 3100).
 */
const base = process.env.PHONE_TEST_BASE_URL || 'http://localhost:3100'

async function get(path) {
  const res = await fetch(`${base}${path}`)
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, json }
}

async function main() {
  const checks = []
  const readiness = await get('/api/phone/readiness')
  checks.push(['readiness', readiness.ok])

  const settings = await get('/api/phone/settings')
  checks.push(['settings', settings.ok])

  const calls = await get('/api/phone/calls?limit=1')
  checks.push(['calls list', calls.ok])

  const routing = await get('/api/phone/routing')
  checks.push(['routing', routing.ok])

  const analytics = await get('/api/phone/analytics?range=7d')
  checks.push(['analytics', analytics.ok])

  const campaigns = await get('/api/phone/power-dialer/campaigns')
  checks.push(['power dialer campaigns', campaigns.ok])

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

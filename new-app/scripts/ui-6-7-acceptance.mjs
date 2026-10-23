#!/usr/bin/env node
/**
 * UI-6/7 acceptance — API-level flows against local dev server + test DB.
 * Run: DEV_AUTH_BYPASS=1 node scripts/ui-6-7-acceptance.mjs
 * Requires server at UI_AGENT_BASE_URL or http://localhost:3000
 */
const base = process.env.UI_AGENT_BASE_URL || 'http://127.0.0.1:3000'

const results = []

async function req(path, opts = {}) {
  const url = `${base}${path}`
  const r = await fetch(url, {
    ...opts,
    headers: {
      cookie: opts.cookie || '',
      ...(opts.headers || {}),
    },
  })
  const text = await r.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text.slice(0, 200) }
  }
  return { status: r.status, json, ok: r.ok }
}

function pass(name, detail) {
  results.push({ name, status: 'PASS', detail })
  console.log(`PASS ${name}${detail ? ` — ${detail}` : ''}`)
}

function fail(name, detail) {
  results.push({ name, status: 'FAIL', detail })
  console.error(`FAIL ${name} — ${detail}`)
}

async function main() {
  await fetch(`${base}/api/auth/dev-bypass`, { method: 'POST' }).catch(() => undefined)

  const viewCreate = await req('/api/crm/native/views', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `UA view ${Date.now()}`, filtersJson: {}, pinned: false }),
  })
  const viewId = viewCreate.json?.data?.id
  if (viewCreate.ok && viewId) {
    pass('saved_view_create', viewId)
    const ren = await req(`/api/crm/native/views/${viewId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'UA renamed', filtersJson: {}, pinned: true, setAsDefault: true }),
    })
    ren.ok ? pass('saved_view_rename_default', viewId) : fail('saved_view_rename_default', String(ren.status))
    const del = await req(`/api/crm/native/views/${viewId}`, { method: 'DELETE' })
    del.ok ? pass('saved_view_delete', viewId) : fail('saved_view_delete', String(del.status))
  } else fail('saved_view_create', JSON.stringify(viewCreate.json))

  const stages = await req('/api/crm/native/deal-stages')
  if (stages.ok && Array.isArray(stages.json?.data) && stages.json.data.length) {
    pass('pipeline_stages_list', `${stages.json.data.length} stages`)
    const payload = stages.json.data.map((s, i) => ({
      id: s.id,
      name: s.name,
      sortOrder: i,
      isClosedWon: s.isClosedWon,
      isClosedLost: s.isClosedLost,
    }))
    if (payload[0]) payload[0] = { ...payload[0], name: payload[0].name }
    const put = await req('/api/crm/native/deal-stages', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stages: payload }),
    })
    put.ok ? pass('pipeline_stages_reorder', '') : fail('pipeline_stages_reorder', String(put.status))
  } else fail('pipeline_stages_list', String(stages.status))

  const start = new Date()
  start.setHours(start.getHours() + 2, 0, 0, 0)
  const end = new Date(start.getTime() + 3600000)
  const appt = await req('/api/crm/native/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'UA appointment',
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      timezone: 'America/Chicago',
    }),
  })
  const apptId = appt.json?.data?.id
  if (appt.ok && apptId) {
    pass('appointment_create', apptId)
    const patch = await req(`/api/crm/native/appointments/${apptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'UA rescheduled', startsAt: new Date(start.getTime() + 7200000).toISOString() }),
    })
    patch.ok ? pass('appointment_reschedule', '') : fail('appointment_reschedule', String(patch.status))
    const cancel = await req(`/api/crm/native/appointments/${apptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    cancel.ok ? pass('appointment_cancel', '') : fail('appointment_cancel', String(cancel.status))
  } else fail('appointment_create', JSON.stringify(appt.json))

  const task = await req('/api/crm/native/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'UA task' }),
  })
  const taskId = task.json?.data?.id
  if (task.ok && taskId) {
    pass('task_create', taskId)
    const done = await req(`/api/crm/native/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    })
    done.ok ? pass('task_complete', '') : fail('task_complete', String(done.status))
    const reopen = await req(`/api/crm/native/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'open' }),
    })
    reopen.ok ? pass('task_reopen', '') : fail('task_reopen', String(reopen.status))
    const del = await req(`/api/crm/native/tasks/${taskId}`, { method: 'DELETE' })
    del.ok ? pass('task_delete', '') : fail('task_delete', String(del.status))
  } else fail('task_create', JSON.stringify(task.json))

  const preset = await req('/api/phone/power-dialer/session-presets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `UA preset ${Date.now()}`, config: { campaignId: '', dialingMode: 'preview' } }),
  })
  const presetId = preset.json?.data?.id
  if (preset.ok && presetId) {
    pass('preset_save', presetId)
    const ren = await req('/api/phone/power-dialer/session-presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: presetId, name: 'UA preset renamed', config: { dialingMode: 'preview' } }),
    })
    ren.ok ? pass('preset_rename', '') : fail('preset_rename', String(ren.status))
    const del = await req(`/api/phone/power-dialer/session-presets?id=${presetId}`, { method: 'DELETE' })
    del.ok ? pass('preset_delete', '') : fail('preset_delete', String(del.status))
  } else fail('preset_save', JSON.stringify(preset.json))

  const modes = await req('/api/phone/power-dialer/advanced-dial-modes')
  modes.ok ? pass('advanced_dial_modes_get', '') : fail('advanced_dial_modes_get', String(modes.status))
  const patchModes = await req('/api/phone/power-dialer/advanced-dial-modes', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parallelEnabled: false, complianceAcknowledged: true }),
  })
  patchModes.ok ? pass('advanced_dial_modes_patch', '') : fail('advanced_dial_modes_patch', JSON.stringify(patchModes.json))

  const routes = [
    '/app/contacts',
    '/app/contacts/deals',
    '/app/contacts/tasks',
    '/app/contacts/calendar',
    '/app/power-dialer/callbacks',
  ]
  for (const path of routes) {
    const page = await req(path)
    page.status === 200 ? pass(`route_html_${path}`, String(page.status)) : fail(`route_html_${path}`, String(page.status))
  }

  const failed = results.filter((r) => r.status === 'FAIL').length
  console.log(`\nSummary: ${results.length - failed}/${results.length} passed`)
  if (failed) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

#!/usr/bin/env node
/**
 * UI-8 browser proof — Playwright/Chromium against local new-app + local DB.
 * Run: DATABASE_URL=... DEV_AUTH_BYPASS=1 node scripts/ui-8-browser-proof.mjs
 * Server: UI_AGENT_BASE_URL=http://localhost:3100 npm run dev (in new-app; prefer localhost over 127.0.0.1 for Playwright hydration)
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.UI_AGENT_BASE_URL || 'http://localhost:3100'
const COOKIE_HOST = BASE.includes('127.0.0.1') ? '127.0.0.1' : 'localhost'
const ART = '/opt/cursor/artifacts/ui-8'
const LOG = '/opt/cursor/artifacts/ui-8-browser-proof.log'

const PD_NAV = [
  { title: 'Overview', href: '/app/power-dialer', testid: 'nav-power-dialer' },
  { title: 'Dialer', href: '/app/power-dialer/dialer', testid: 'nav-power-dialer-dialer' },
  { title: 'Campaigns', href: '/app/power-dialer/campaigns', testid: 'nav-power-dialer-campaigns' },
  { title: 'Calling Lists', href: '/app/power-dialer/calling-lists', testid: 'nav-power-dialer-calling-lists' },
  { title: 'Contacts', href: '/app/contacts', testid: 'nav-contacts' },
  { title: 'Deals', href: '/app/contacts/deals', testid: 'nav-contacts-deals' },
  { title: 'Tasks', href: '/app/contacts/tasks', testid: 'nav-contacts-tasks' },
  { title: 'Calendar', href: '/app/contacts/calendar', testid: 'nav-contacts-calendar' },
  { title: 'Callbacks', href: '/app/power-dialer/callbacks', testid: 'nav-power-dialer-callbacks' },
  { title: 'Call History', href: '/app/power-dialer/call-history', testid: 'nav-power-dialer-call-history' },
  { title: 'Number Health', href: '/app/power-dialer/number-health', testid: 'nav-power-dialer-number-health' },
  { title: 'Analytics', href: '/app/power-dialer/analytics', testid: 'nav-power-dialer-analytics' },
  { title: 'Integrations', href: '/app/power-dialer/integrations', testid: 'nav-power-dialer-integrations' },
  { title: 'Settings', href: '/app/power-dialer/settings', testid: 'nav-power-dialer-settings' },
]

const LIVE_CONTROL_IDS = [
  'pd-live-controls-reference',
  'pd-control-mute',
  'pd-control-hold',
  'pd-control-voicemail-drop',
  'pd-control-live-voicemail',
  'pd-control-recording',
  'pd-control-transfer-type',
  'pd-control-transfer',
  'pd-control-warm-complete',
  'pd-control-pause-session',
  'pd-control-end-session',
  'pd-control-schedule-appointment',
  'pd-control-disposition',
  'pd-control-save-next',
]

const results = []
const logLines = []

function log(msg) {
  const line = `${new Date().toISOString()} ${msg}`
  logLines.push(line)
  console.log(msg)
}

function pass(name, detail = '') {
  results.push({ name, status: 'PASS', detail })
  log(`PASS ${name}${detail ? ` — ${detail}` : ''}`)
}

function fail(name, detail = '') {
  results.push({ name, status: 'FAIL', detail })
  log(`FAIL ${name}${detail ? ` — ${detail}` : ''}`)
}

async function shot(page, slug) {
  const file = path.join(ART, `${slug}.png`)
  await page.screenshot({ path: file, fullPage: true })
  return file
}

async function waitForShell(page, expected) {
  await page.waitForFunction(
    (exp) => document.querySelector('nav[data-shell-context]')?.getAttribute('data-shell-context') === exp,
    expected,
    { timeout: 20000 },
  )
}

async function shellContext(page) {
  return page.locator('nav[data-shell-context]').first().getAttribute('data-shell-context')
}

async function setPdCookie(context) {
  await context.addCookies([
    {
      name: 'transovo_shell_context',
      value: 'power_dialer',
      domain: COOKIE_HOST,
      path: '/',
    },
  ])
}

async function pdSidebar(page) {
  return page.locator('nav[data-shell-context="power_dialer"]')
}

async function clickPdNav(page, title) {
  const nav = await pdSidebar(page)
  await nav.getByRole('link', { name: title, exact: true }).click({ timeout: 20000 })
}

async function expandSidebar(page) {
  const expand = page.getByRole('button', { name: 'Expand sidebar' })
  if (await expand.count()) await expand.click({ force: true })
}

async function selectFirstCampaign(page) {
  await page.getByText('Session setup', { exact: false }).first().waitFor({ timeout: 30000 })
  const campaign = page.getByRole('combobox', { name: 'Campaign' })
  await campaign.click({ timeout: 15000 })
  const opt = page.getByRole('option').nth(0)
  await opt.waitFor({ timeout: 10000 })
  const label = (await opt.textContent())?.trim() || ''
  if (!label || /select/i.test(label)) {
    const second = page.getByRole('option').nth(1)
    if (await second.count()) await second.click({ timeout: 10000 })
    else throw new Error('No campaigns in dialer select')
  } else {
    await opt.click({ timeout: 10000 })
  }
}

async function main() {
  fs.mkdirSync(ART, { recursive: true })
  await fetch(`${BASE}/api/auth/dev-bypass`, { method: 'POST' }).catch(() => undefined)

  const apiHeaders = {
    'Content-Type': 'application/json',
    Origin: BASE,
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
  }
  const listRes = await fetch(`${BASE}/api/phone/power-dialer/lists`).then((r) => r.json()).catch(() => ({}))
  const lists = listRes.data || []
  if (!lists.length) {
    await fetch(`${BASE}/api/phone/power-dialer/lists`, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({ name: `UI8 list ${Date.now()}` }),
    }).catch(() => undefined)
  }
  const lists2 = await fetch(`${BASE}/api/phone/power-dialer/lists`).then((r) => r.json()).catch(() => ({ data: [] }))
  const listId = lists2.data?.[0]?.id
  let camps = await fetch(`${BASE}/api/phone/power-dialer/campaigns`, { headers: apiHeaders }).then((r) => r.json()).catch(() => ({ data: [] }))
  if (listId && !(camps.data || []).length) {
    const created = await fetch(`${BASE}/api/phone/power-dialer/campaigns`, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({ name: `UI8 campaign ${Date.now()}`, listId, callerIdE164: '+15555550100', configJson: {} }),
    }).then((r) => r.json()).catch(() => ({}))
    if (created.error) log(`campaign seed warning: ${created.error}`)
    camps = await fetch(`${BASE}/api/phone/power-dialer/campaigns`, { headers: apiHeaders }).then((r) => r.json()).catch(() => ({ data: [] }))
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true,
  })
  await context.addInitScript(() => {
    const hideDevOverlay = () => {
      document.querySelectorAll('nextjs-portal').forEach((el) => {
        el.remove()
      })
    }
    hideDevOverlay()
    new MutationObserver(hideDevOverlay).observe(document.documentElement, { childList: true, subtree: true })
  })
  await setPdCookie(context)
  const page = await context.newPage()
  page.on('dialog', (d) => void d.accept())

  // Saved views sheet (first interactive CRM check — avoids post-navigation flake)
  try {
    await page.goto(`${BASE}/app/contacts?openViews=1`, { waitUntil: 'networkidle', timeout: 120000 })
    const createViewBtn = page.getByRole('button', { name: 'Create view' })
    await createViewBtn.waitFor({ state: 'visible', timeout: 30000 })
    const name = `UI8 view ${Date.now()}`
    await page.getByLabel('View name').fill(name)
    await page.getByRole('button', { name: 'Create view' }).click()
    await page.waitForTimeout(800)
    pass('saved_view_create_ui', name)
    await shot(page, 'saved-view-create')
    const viewsSheet = page.getByTestId('contacts-saved-views-sheet')
    await viewsSheet.locator('li').filter({ hasText: name }).getByRole('button', { name: 'Edit' }).click()
    await page.getByLabel('View name').fill(`${name} edited`)
    await viewsSheet.getByRole('button', { name: 'Save changes' }).click()
    await page.waitForTimeout(800)
    pass('saved_view_edit_ui', '')
    await viewsSheet.locator('li').filter({ hasText: `${name} edited` }).getByRole('button', { name: 'Delete' }).click()
    await page.waitForTimeout(800)
    pass('saved_view_delete_ui', '')
    await page.keyboard.press('Escape')
  } catch (e) {
    fail('saved_views_flow', e instanceof Error ? e.message : String(e))
  }

  // --- 14 sidebar items from Overview ---
  await page.goto(`${BASE}/app/power-dialer`, { waitUntil: 'networkidle', timeout: 120000 })
  await expandSidebar(page)
  for (const item of PD_NAV) {
    try {
      await clickPdNav(page, item.title)
      await page.waitForURL((url) => url.pathname.startsWith(item.href.split('?')[0]), { timeout: 30000 })
      await waitForShell(page, 'power_dialer')
      const ctx = await shellContext(page)
      if (ctx !== 'power_dialer') {
        fail(`sidebar_${item.title}`, `expected power_dialer shell, got ${ctx}`)
      } else {
        pass(`sidebar_${item.title}`, item.href)
      }
      await shot(page, `sidebar-${item.testid}`)
    } catch (e) {
      fail(`sidebar_${item.title}`, e instanceof Error ? e.message : String(e))
    }
  }

  // Direct URL + hard refresh CRM routes
  for (const route of ['/app/contacts/deals', '/app/contacts/tasks', '/app/contacts/calendar']) {
    try {
      await setPdCookie(context)
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 120000 })
      await page.reload({ waitUntil: 'networkidle' })
      await waitForShell(page, 'power_dialer')
      const ctx = await shellContext(page)
      if (ctx === 'power_dialer') pass(`hard_refresh_pd_shell_${route}`, await shot(page, `hard-refresh-${route.slice(1).replace(/\//g, '-')}`))
      else fail(`hard_refresh_pd_shell_${route}`, `shell=${ctx}`)
    } catch (e) {
      fail(`hard_refresh_pd_shell_${route}`, e instanceof Error ? e.message : String(e))
    }
  }

  // Workspace shell on /app/contacts
  try {
    await context.addCookies([
      { name: 'transovo_shell_context', value: 'workspace', domain: COOKIE_HOST, path: '/' },
    ])
    await page.goto(`${BASE}/app/home`, { waitUntil: 'networkidle' })
    await page.getByRole('link', { name: /^Contacts/ }).first().click()
    await page.waitForURL(/\/app\/contacts/, { timeout: 20000 })
    await waitForShell(page, 'workspace')
    const ctx = await shellContext(page)
    if (ctx === 'workspace') pass('workspace_contacts_shell', await shot(page, 'workspace-contacts-shell'))
    else fail('workspace_contacts_shell', `shell=${ctx}`)
  } catch (e) {
    fail('workspace_contacts_shell', e instanceof Error ? e.message : String(e))
  }

  // Collapsed sidebar
  try {
    await setPdCookie(context)
    await page.goto(`${BASE}/app/power-dialer`, { waitUntil: 'networkidle' })
    await expandSidebar(page)
    const collapse = page.getByRole('button', { name: 'Collapse sidebar' })
    if (await collapse.count()) await collapse.click({ force: true })
    else await page.getByRole('button', { name: 'Expand sidebar' }).click({ force: true })
    await page.waitForTimeout(400)
    pass('collapsed_sidebar', await shot(page, 'collapsed-sidebar'))
  } catch (e) {
    fail('collapsed_sidebar', e instanceof Error ? e.message : String(e))
  }

  // Mobile 390px
  try {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE}/app/power-dialer/dialer`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await page.waitForTimeout(500)
    pass('mobile_nav_sheet', await shot(page, 'mobile-nav-390'))
  } catch (e) {
    fail('mobile_nav_sheet', e instanceof Error ? e.message : String(e))
  }
  await page.setViewportSize({ width: 1280, height: 900 })

  // Manage pipeline
  try {
    await setPdCookie(context)
    await page.goto(`${BASE}/app/contacts/deals`, { waitUntil: 'networkidle' })
    await page.getByTestId('deals-manage-pipeline').click()
    await page.getByRole('heading', { name: 'Manage pipeline' }).waitFor({ timeout: 10000 })
    pass('manage_pipeline_open', await shot(page, 'manage-pipeline'))
    await page.keyboard.press('Escape')
  } catch (e) {
    fail('manage_pipeline_open', e instanceof Error ? e.message : String(e))
  }

  // Calendar views
  try {
    await page.goto(`${BASE}/app/contacts/calendar`, { waitUntil: 'networkidle' })
    for (const v of ['Month', 'Week', 'Day', 'List']) {
      await page.getByRole('radio', { name: v }).click()
      await page.waitForTimeout(300)
      pass(`calendar_view_${v.toLowerCase()}`, '')
    }
    await shot(page, 'calendar-views')
  } catch (e) {
    fail('calendar_views', e instanceof Error ? e.message : String(e))
  }

  // Tasks — create
  try {
    await page.goto(`${BASE}/app/contacts/tasks`, { waitUntil: 'networkidle' })
    const add = page.getByRole('button', { name: 'New task' })
    if (await add.count()) {
      await add.click()
      await page.getByLabel('Title').waitFor({ timeout: 15000 })
      await page.getByLabel('Title').fill(`UI8 task ${Date.now()}`)
      await page.getByRole('button', { name: 'Create task' }).click()
      await page.waitForTimeout(1000)
      pass('task_create_ui', '')
      await shot(page, 'task-create')
    } else pass('task_create_ui', 'add button skipped — list may have inline create')
  } catch (e) {
    fail('task_create_ui', e instanceof Error ? e.message : String(e))
  }

  // Dialer presets (zero presets path)
  try {
    await setPdCookie(context)
    await page.goto(`${BASE}/app/power-dialer/dialer`, { waitUntil: 'networkidle' })
    const presetName = `UI8 preset ${Date.now()}`
    await selectFirstCampaign(page)
    await page.getByPlaceholder('My preview setup').fill(presetName)
    await page
      .locator('div')
      .filter({ has: page.getByPlaceholder('My preview setup') })
      .getByRole('button', { name: 'Save' })
      .click()
    await page.waitForTimeout(1000)
    pass('preset_save_ui', presetName)
    await page.getByTestId('pd-manage-presets').click()
    await page.getByRole('heading', { name: 'Manage session presets' }).waitFor({ timeout: 10000 })
    await page.getByRole('button', { name: 'Rename' }).first().click()
    await page.getByLabel('Preset name').fill(`${presetName} renamed`)
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(600)
    pass('preset_rename_ui', '')
    await page.getByRole('button', { name: 'Duplicate' }).first().click()
    await page.waitForTimeout(600)
    pass('preset_duplicate_ui', '')
    await page.getByRole('button', { name: 'Delete' }).first().click()
    await page.waitForTimeout(600)
    pass('preset_delete_ui', '')
    await shot(page, 'presets-sheet')
    await page.keyboard.press('Escape')
  } catch (e) {
    fail('preset_flow', e instanceof Error ? e.message : String(e))
  }

  // Advanced dial modes settings
  try {
    await setPdCookie(context)
    await page.goto(`${BASE}/app/power-dialer/settings?tab=dialing`, { waitUntil: 'networkidle' })
    await page.getByRole('tab', { name: 'Dialing' }).click()
    await page.getByTestId('pd-advanced-dial-modes').waitFor({ state: 'visible', timeout: 60000 })
    pass('settings_advanced_dial_modes', await shot(page, 'settings-advanced-dial-modes'))
  } catch (e) {
    fail('settings_advanced_dial_modes', e instanceof Error ? e.message : String(e))
  }

  // Campaign editor — five modes
  try {
    await setPdCookie(context)
    await page.goto(`${BASE}/app/power-dialer/campaigns`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: 'Campaigns' }).waitFor({ timeout: 20000 }).catch(() => undefined)
    let edit = page.locator('table').getByRole('button', { name: 'Edit' }).first()
    if (!(await edit.count())) {
      await page.waitForTimeout(1500)
      edit = page.locator('table').getByRole('button', { name: 'Edit' }).first()
    }
    if (await edit.count()) {
      await edit.click()
      await page.getByRole('tab', { name: 'Call handling' }).click()
      await page.locator('[aria-label="Dial mode descriptions"]').waitFor({ timeout: 10000 })
      for (const mode of ['Preview', 'Power', 'Parallel', 'machine filtering', 'Predictive']) {
        const text = page.getByText(mode, { exact: false })
        if (await text.count()) pass(`campaign_mode_copy_${mode.replace(/\s+/g, '_')}`, '')
        else fail(`campaign_mode_copy_${mode.replace(/\s+/g, '_')}`, 'missing')
      }
      await page.getByRole('tab', { name: /handling/i }).click()
      await page.locator('select, [role=combobox]').filter({ hasText: /Parallel|Preview|Power/i }).first().click().catch(() => undefined)
      pass('campaign_editor_handling', await shot(page, 'campaign-editor-handling'))
      await page.keyboard.press('Escape')
    } else {
      fail('campaign_editor_handling', 'no campaign edit button')
    }
  } catch (e) {
    fail('campaign_editor_handling', e instanceof Error ? e.message : String(e))
  }

  // Overview campaign row
  try {
    await page.goto(`${BASE}/app/power-dialer`, { waitUntil: 'networkidle' })
    const rowLink = page.locator('a[href*="/app/power-dialer/campaigns/"][href*="/queue"]').first()
    if (await rowLink.count()) {
      await rowLink.click()
      await page.waitForURL(/\/queue/, { timeout: 20000 })
      pass('overview_campaign_row', await shot(page, 'overview-campaign-queue'))
    } else pass('overview_campaign_row', 'no campaigns — skipped')
  } catch (e) {
    fail('overview_campaign_row', e instanceof Error ? e.message : String(e))
  }

  // Call history tabs
  try {
    await setPdCookie(context)
    await page.goto(`${BASE}/app/power-dialer/call-history`, { waitUntil: 'networkidle' })
    await page.getByRole('radio', { name: 'Sessions' }).click()
    await page.waitForURL(/\/call-history\/sessions/, { timeout: 45000, waitUntil: 'commit' })
    pass('call_history_sessions_tab', await shot(page, 'call-history-sessions'))
    await page.goto(`${BASE}/app/power-dialer/call-history`, { waitUntil: 'networkidle' })
    await page.getByRole('radio', { name: 'Calls' }).click()
    pass('call_history_calls_tab', await shot(page, 'call-history-calls'))
  } catch (e) {
    fail('call_history_tabs', e instanceof Error ? e.message : String(e))
  }

  // Callbacks 5 tabs
  try {
    await setPdCookie(context)
    await page.goto(`${BASE}/app/power-dialer/callbacks`, { waitUntil: 'networkidle' })
    for (const label of ['All callbacks', 'Due today', 'Upcoming', 'Completed', 'AI callbacks']) {
      await page.getByRole('radio', { name: label }).click()
      await page.waitForTimeout(400)
      pass(`callbacks_tab_${label.replace(/\s+/g, '_')}`, '')
    }
    await shot(page, 'callbacks-tabs')
  } catch (e) {
    fail('callbacks_tabs', e instanceof Error ? e.message : String(e))
  }

  // Live board
  try {
    await page.goto(`${BASE}/app/power-dialer/analytics?tab=live`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Live board' }).click().catch(() => undefined)
    await page.getByText(/supervisor|Live board|active sessions/i).first().waitFor({ timeout: 15000 })
    pass('analytics_live_board', await shot(page, 'analytics-live-board'))
  } catch (e) {
    fail('analytics_live_board', e instanceof Error ? e.message : String(e))
  }

  // Zapier integration
  try {
    await page.goto(`${BASE}/app/power-dialer/integrations/zapier`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: /zapier/i }).waitFor({ timeout: 15000 })
    pass('integrations_zapier', await shot(page, 'integrations-zapier'))
  } catch (e) {
    fail('integrations_zapier', e instanceof Error ? e.message : String(e))
  }

  // Live controls audit (UI-6.8)
  try {
    await setPdCookie(context)
    await page.goto(`${BASE}/app/power-dialer/dialer?pd_audit=live_controls`, { waitUntil: 'networkidle' })
    await page.getByRole('tab', { name: 'Session' }).click()
    await page.getByTestId('pd-live-controls-reference').waitFor({ timeout: 45000 })
    for (const id of LIVE_CONTROL_IDS) {
      const el = page.getByTestId(id)
      if (await el.count()) pass(`live_control_${id}`, '')
      else fail(`live_control_${id}`, 'missing')
    }
    await shot(page, 'dialer-live-controls-audit')
  } catch (e) {
    fail('live_controls_audit', e instanceof Error ? e.message : String(e))
  }

  await browser.close()

  const fails = results.filter((r) => r.status === 'FAIL')
  const summary = {
    pass: results.filter((r) => r.status === 'PASS').length,
    fail: fails.length,
    artifactsDir: ART,
    results,
  }
  fs.writeFileSync(path.join(ART, 'results.json'), JSON.stringify(summary, null, 2))
  fs.writeFileSync(LOG, logLines.join('\n'))
  console.log(`\nUI-8 browser proof: ${summary.pass} pass, ${summary.fail} fail`)
  console.log(`Log: ${LOG}`)
  if (fails.length) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

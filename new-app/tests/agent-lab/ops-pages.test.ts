import { describe, expect, it } from 'vitest'
import {
  assignments,
  calendarEntries,
  cronToWords,
  groupActivity,
  responsibilityStatus,
  runState,
  type OpsRoutine,
  type OpsRun,
} from '@/lib/agent-lab/ops'
import { AGENT_NAV, VIDEO_NAV_HIDDEN, activeAgentNavId, buildSidebarNav, visibleSidebarNav } from '@/lib/sidebar-nav'

const run = (p: Partial<OpsRun>): OpsRun => ({
  id: p.id ?? Math.random().toString(36).slice(2),
  source: null,
  routineId: null,
  helper: false,
  title: 'Task',
  conversationId: null,
  status: 'done',
  attempts: 1,
  createdAt: '2026-11-28T13:00:00Z',
  startedAt: null,
  finishedAt: null,
  progress: null,
  error: null,
  ...p,
})

const routine = (p: Partial<OpsRoutine>): OpsRoutine => ({
  id: 'r1',
  name: 'Reminders',
  kind: 'cron',
  cron: '0 8 * * 1-5',
  tz: 'America/New_York',
  action: 'agent',
  instruction: null,
  paused: false,
  done: false,
  nextRunAt: null,
  lastRunAt: null,
  lastRunId: null,
  ...p,
})

describe('agent lab work pages', () => {
  it('describes schedules in plain words', () => {
    expect(cronToWords('0 8 * * 1-5')).toBe('Every weekday at 8:00 AM')
    expect(cronToWords('30 9 * * 1')).toBe('Every Monday at 9:30 AM')
    expect(cronToWords('5 * * * *')).toBe('Every hour')
    expect(cronToWords('*/15 * * * *')).toBe('Every 15 minutes')
    expect(cronToWords('0 18 * * *')).toBe('Every day at 6:00 PM')
    expect(cronToWords(null, 'webhook')).toBe('When its trigger fires')
  })

  it('maps runner statuses', () => {
    expect(runState('queued')).toBe('working')
    expect(runState('failed')).toBe('failed')
    expect(runState('stopped')).toBe('stopped')
    expect(runState('done')).toBe('done')
  })

  it('derives responsibility status', () => {
    expect(responsibilityStatus(routine({ paused: true }), [], [])).toBe('paused')
    expect(responsibilityStatus(routine({}), [run({ routineId: 'r1', status: 'running' })], [])).toBe('working')
    expect(responsibilityStatus(routine({}), [run({ routineId: 'r1', status: 'failed' })], [])).toBe('failed')
    expect(responsibilityStatus(routine({}), [run({ routineId: 'r1', status: 'failed', attempts: 3 })], [])).toBe('blocked')
    const r = run({ id: 'x', routineId: 'r1', status: 'running' })
    expect(
      responsibilityStatus(routine({}), [r], [{ id: 'q', runId: 'x', conversationId: null, title: null, question: '?', choices: [], createdAt: '', expiresAt: null }]),
    ).toBe('waiting')
    expect(responsibilityStatus(routine({}), [], [])).toBe('enabled')
  })

  it('groups consecutive nothing-found checks and hides helpers', () => {
    const runs = [
      run({ routineId: 'r1', progress: 'Nothing new this hour' }),
      run({ routineId: 'r1', progress: 'No new posts' }),
      run({ routineId: 'r1', progress: 'Found 2 posts' }),
      run({ helper: true }),
    ]
    const g = groupActivity(runs, () => 'Reddit watch')
    expect(g).toHaveLength(2)
    expect(g[0].kind).toBe('quiet')
    if (g[0].kind === 'quiet') expect(g[0].runs).toHaveLength(2)
    expect(g[1].kind).toBe('run')
  })

  it('assignments are top-level runs no responsibility started', () => {
    expect(assignments([run({ id: 'a' }), run({ id: 'b', routineId: 'r1' }), run({ id: 'c', helper: true })]).map((r) => r.id)).toEqual(['a'])
  })

  it('calendar shows completed runs and upcoming routine runs in range', () => {
    const e = calendarEntries(
      { runs: [run({ startedAt: '2026-11-24T13:00:00Z' })], routines: [routine({ nextRunAt: '2026-11-30T13:00:00Z' }), routine({ id: 'r2', paused: true, nextRunAt: '2026-11-29T13:00:00Z' })], questions: [] },
      new Date('2026-11-23T00:00:00Z'),
      new Date('2026-12-01T00:00:00Z'),
    )
    expect(e.map((x) => x.state)).toEqual(['done', 'upcoming'])
  })

  it('puts every Agent Lab page on the main menu and hides video items', () => {
    const f = { recording: true, soloRecording: false, scriptEditor: false, t2v: true }
    const ids = visibleSidebarNav(f).map((i) => i.id)
    for (const i of AGENT_NAV) expect(ids).toContain(i.id)
    expect(AGENT_NAV.map((i) => i.label)).toEqual([
      'Dashboard', 'Chat', 'Needs you', 'Responsibilities', 'Activity', 'Calendar', 'Calls', 'Assignments', 'Permissions', 'Connections', 'Computer', 'Files', 'Memory & skills',
    ])
    if (VIDEO_NAV_HIDDEN) {
      for (const v of ['clips', 'editor', 'motion-studio', 'streamer', 'templates']) expect(ids).not.toContain(v)
    }
    expect(ids).toContain('settings')
    // the full product list still exists for when video comes back
    expect(buildSidebarNav(f).some((i) => i.id === 'motion-studio')).toBe(true)
    expect(activeAgentNavId('/app/agent-lab')).toBe('agent-chat')
    expect(activeAgentNavId('/app/agent-lab/connections')).toBe('agent-connections')
    expect(activeAgentNavId('/app/agent-lab/needs-you/')).toBe('agent-needs-you')
    expect(activeAgentNavId('/app/clips')).toBeNull()
  })
})

describe('dashboard', () => {
  it('summarises responsibilities, failures and results from the overview', async () => {
    const { dashboardSummary, chatHref } = await import('@/lib/agent-lab/ops')
    const now = Date.parse('2026-11-28T14:00:00Z')
    const run = (id: string, status: string, extra: Record<string, unknown> = {}) => ({
      id, source: 'user', routineId: null, helper: false, title: id, conversationId: `c-${id}`, status, attempts: 1,
      createdAt: '2026-11-28T12:00:00Z', startedAt: null, finishedAt: '2026-11-28T12:05:00Z', progress: null, error: null, ...extra,
    })
    const routine = (id: string, paused: boolean) => ({
      id, name: id, kind: 'cron', cron: '0 8 * * *', tz: null, action: null, instruction: null, paused, done: false,
      nextRunAt: '2026-11-29T13:00:00Z', lastRunAt: null, lastRunId: null,
    })
    const s = dashboardSummary({
      runs: [run('a', 'done'), run('b', 'failed', { error: 'x' }), run('q', 'done', { progress: 'Nothing new today' }), run('w', 'running', { finishedAt: null })],
      routines: [routine('r1', false), routine('r2', true)],
      questions: [],
    }, now)
    expect(s.activeResponsibilities).toBe(1)
    expect(s.pausedResponsibilities).toBe(1)
    expect(s.failures.map((r) => r.id)).toEqual(['b'])
    expect(s.recentResults.map((r) => r.id).sort()).toEqual(['a', 'b'])
    expect(s.quietChecks).toBe(1)
    expect(s.workingNow).toBe(1)
    expect(s.nextUp?.title).toBe('r1')
    expect(chatHref('abc')).toBe('/app/agent-lab?c=abc')
  })

  it('marks Dashboard active on /app only', async () => {
    const { activeAgentNavId } = await import('@/lib/sidebar-nav')
    expect(activeAgentNavId('/app')).toBe('agent-home')
    expect(activeAgentNavId('/app/agent-lab/files')).toBe('agent-files')
    expect(activeAgentNavId('/app/clips')).toBe(null)
  })
})


describe('display names and calls', () => {
  it('formats slugs for display and leaves stored prose, phones and ids alone', async () => {
    const { displayName } = await import('@/lib/agent-lab/ops')
    expect(displayName('weekly-fx-report')).toBe('Weekly FX report')
    expect(displayName('Weekly FX report')).toBe('Weekly FX report')
    expect(displayName('draft_replies_to_unanswered_reviews')).toBe('Draft replies to unanswered reviews')
    expect(displayName('ai-email-summary')).toBe('AI email summary')
    expect(displayName('weeklyFxReport')).toBe('Weekly FX report')
    expect(displayName('weekly-fx-report.pdf')).toBe('Weekly FX report.pdf')
    expect(displayName('List Supabase projects')).toBe('List Supabase projects')
    expect(displayName('googleads')).toBe('Google Ads')
    expect(displayName('555-123-4567')).toBe('555-123-4567')
    expect(displayName('run_d080c2b93a')).toBe('run_d080c2b93a')
    expect(displayName(null)).toBe('')
  })

  it('labels incoming and outgoing calls with party, duration and outcome', async () => {
    const { callDirection, callParty, callNumber, callOutcome, formatDuration } = await import('@/lib/agent-lab/ops')
    const out = { kind: 'outbound' as const, who: 'Alex Rivera', to: '+1 555 0100', status: 'completed', duration_s: 125 }
    const inn = { kind: 'inbound' as const, who: 'Jordan Lee', caller: 'Jordan Lee', status: 'missed', duration_s: 0 }
    expect(callDirection(out)).toBe('outgoing')
    expect(callDirection(inn)).toBe('incoming')
    expect(callParty(out)).toBe('Alex Rivera')
    expect(callParty(inn)).toBe('Jordan Lee')
    expect(callOutcome(out)?.label).toBe('Completed')
    expect(callOutcome({ ...inn, needs_you: true })?.label).toBe('Missed')
    expect(callOutcome({ outcome: 'Took a message' })?.label).toBe('Took a message')
    expect(callOutcome({ outcome: 'Booked an appointment' })?.tone).toBe('success')
    expect(callParty({ kind: 'inbound', caller: 'Jordan Lee', caller_number: '+1 555 0100' })).toBe('Jordan Lee')
    expect(callNumber({ kind: 'inbound', caller: 'Jordan Lee', caller_number: '+1 555 0100' })).toBe('+1 555 0100')
    expect(formatDuration(125)).toBe('2 min 5 s')
    expect(formatDuration(0, 'missed')).toBe('Missed')
    expect(formatDuration(null)).toBe('')
  })

  it('marks Memory & skills active', async () => {
    const { activeAgentNavId, AGENT_NAV } = await import('@/lib/sidebar-nav')
    expect(AGENT_NAV.some((i) => i.id === 'agent-memory' && i.href === '/app/agent-lab/memory')).toBe(true)
    expect(activeAgentNavId('/app/agent-lab/memory')).toBe('agent-memory')
  })
})


describe('agent chat route', () => {
  it('fills the shell only on the Chat page, not on other Agent Lab pages', async () => {
    const { isAgentChatRoute } = await import('@/lib/sidebar-nav')
    expect(isAgentChatRoute('/app/agent-lab')).toBe(true)
    expect(isAgentChatRoute('/app/agent-lab/')).toBe(true)
    expect(isAgentChatRoute('/app/agent-lab/memory')).toBe(false)
    expect(isAgentChatRoute('/app/agent-lab/needs-you')).toBe(false)
    expect(isAgentChatRoute('/app')).toBe(false)
  })
})

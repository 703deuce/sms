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
      'Chat', 'Needs you', 'Responsibilities', 'Activity', 'Calendar', 'Calls', 'Assignments', 'Permissions', 'Connections', 'Computer', 'Files',
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

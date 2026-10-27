import { describe, expect, it } from 'vitest'
import {
  JOB_HEARTBEAT_STALE_MS,
  JOB_MAX_ATTEMPTS_BEFORE_FAIL,
  reaperBackoffSeconds,
  shouldFailJobAfterStale,
  stalledProjectErrorMessage,
} from '@/lib/server/clips/job-reliability'
import { pickStreamerRetryJobType, streamAnalyzePhaseComplete } from '@/lib/server/streamer/retry-project'

describe('job reliability', () => {
  it('uses 3 minute stale heartbeat (worker lock parity)', () => {
    expect(JOB_HEARTBEAT_STALE_MS).toBe(3 * 60_000)
  })

  it('backs off exponentially with cap', () => {
    expect(reaperBackoffSeconds(1)).toBe(30)
    expect(reaperBackoffSeconds(2)).toBe(60)
    expect(reaperBackoffSeconds(10)).toBe(480)
  })

  it('fails jobs after max attempts', () => {
    expect(shouldFailJobAfterStale(JOB_MAX_ATTEMPTS_BEFORE_FAIL - 1)).toBe(false)
    expect(shouldFailJobAfterStale(JOB_MAX_ATTEMPTS_BEFORE_FAIL)).toBe(true)
  })

  it('formats stalled project errors', () => {
    expect(stalledProjectErrorMessage('FINDING_CLIPS')).toContain('finding clips')
    expect(stalledProjectErrorMessage('FINDING_CLIPS')).toContain('Retry')
  })

  it('picks streamer retry job type from durable state', () => {
    expect(pickStreamerRetryJobType(false, 0)).toBe('STREAM_IMPORT')
    expect(pickStreamerRetryJobType(true, 0)).toBe('STREAM_ANALYZE')
    expect(pickStreamerRetryJobType(true, 3)).toBe('STREAM_RENDER')
    expect(streamAnalyzePhaseComplete({ candidatesKey: 'k' })).toBe(true)
    expect(pickStreamerRetryJobType(true, 0, true)).toBe('STREAM_RENDER')
  })
})

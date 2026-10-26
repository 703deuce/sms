import { describe, expect, it } from 'vitest'
import {
  projectStatusForJobType,
  streamerProjectNeedsRecovery,
} from '@/lib/server/streamer/recover-project'

describe('streamer recovery', () => {
  it('flags non-terminal projects', () => {
    expect(streamerProjectNeedsRecovery('PREPARING')).toBe(true)
    expect(streamerProjectNeedsRecovery('READY')).toBe(false)
    expect(streamerProjectNeedsRecovery('FAILED')).toBe(false)
  })

  it('maps job types to project status', () => {
    expect(projectStatusForJobType('STREAM_IMPORT')).toBe('PREPARING')
    expect(projectStatusForJobType('STREAM_ANALYZE')).toBe('TRANSCRIBING')
    expect(projectStatusForJobType('STREAM_RENDER')).toBe('RENDERING')
  })
})

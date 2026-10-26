import { describe, expect, it } from 'vitest'
import {
  clipperProjectNeedsRecovery,
  isTranscriptReadyOrphan,
} from '@/lib/server/clips/recover-project'

describe('clipper recovery', () => {
  it('detects legacy M3 transcript_ready orphan', () => {
    expect(isTranscriptReadyOrphan('transcript_ready', 'FINDING_CLIPS')).toBe(true)
    expect(isTranscriptReadyOrphan('finding_clips', 'FINDING_CLIPS')).toBe(false)
    expect(isTranscriptReadyOrphan('transcript_ready', 'TRANSCRIBING')).toBe(false)
  })

  it('treats non-terminal clipper statuses as recoverable', () => {
    expect(clipperProjectNeedsRecovery('FINDING_CLIPS')).toBe(true)
    expect(clipperProjectNeedsRecovery('READY')).toBe(false)
    expect(clipperProjectNeedsRecovery('FAILED')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import {
  clipperRetryJobPayload,
  clipperRetryProjectPatch,
  shouldResumeClipperFromTranscript,
  transcriptWordCount,
} from '@/lib/server/clips/project-retry'

describe('clipper retry resume', () => {
  it('counts transcript words', () => {
    expect(transcriptWordCount([{ w: 'a' }, { w: 'b' }])).toBe(2)
    expect(transcriptWordCount(null)).toBe(0)
  })

  it('resumes when transcript is persisted', () => {
    expect(
      shouldResumeClipperFromTranscript({
        status: 'FAILED',
        stage: 'failed',
        transcriptWords: [{ w: 'hello' }],
      }),
    ).toBe(true)
  })

  it('does not resume without transcript', () => {
    expect(
      shouldResumeClipperFromTranscript({
        status: 'FAILED',
        stage: 'transcribing',
        transcriptWords: [],
      }),
    ).toBe(false)
  })

  it('preserves progress floor when resuming', () => {
    const patch = clipperRetryProjectPatch({
      status: 'FAILED',
      stage: 'failed',
      progress: 12,
      transcriptWords: [{ w: 'x' }],
    })
    expect(patch.resume).toBe(true)
    expect(patch.progress).toBe(45)
  })

  it('resets progress when re-running from scratch', () => {
    const patch = clipperRetryProjectPatch({
      status: 'FAILED',
      stage: 'transcribing',
      progress: 12,
      transcriptWords: null,
    })
    expect(patch.resume).toBe(false)
    expect(patch.progress).toBe(0)
  })

  it('sets resume on job payload when appropriate', () => {
    expect(clipperRetryJobPayload(true)).toEqual({ resume: true, retry: true })
    expect(clipperRetryJobPayload(false)).toEqual({ retry: true })
  })
})

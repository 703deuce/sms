import { describe, expect, it } from 'vitest'
import { formatClipProgressEtaLine, isClipWaitingForWorker } from '@/lib/clips/progress-eta-label'

describe('progress-eta-label', () => {
  it('shows waiting copy for queued clipper jobs with no progress', () => {
    expect(isClipWaitingForWorker('QUEUED', 'queued', 0, true)).toBe(true)
    expect(formatClipProgressEtaLine({
      etaSec: 0,
      progress: 0,
      status: 'QUEUED',
      stage: 'queued',
      waitingForWorker: true,
      queueAhead: 2,
    })).toBe('Waiting for a worker… · 3 in queue')
  })

  it('does not show Almost done when queued', () => {
    expect(formatClipProgressEtaLine({
      etaSec: 0,
      progress: 0,
      status: 'QUEUED',
      stage: 'queued',
    })).toBe('Waiting for a worker…')
  })

  it('shows Almost done only with active processing and progress threshold', () => {
    expect(
      formatClipProgressEtaLine({
        etaSec: 0,
        progress: 40,
        status: 'TRANSCRIBING',
        stage: 'transcribing',
      }),
    ).toBe('Almost done…')
    expect(
      formatClipProgressEtaLine({
        etaSec: 0,
        progress: 5,
        status: 'TRANSCRIBING',
        stage: 'transcribing',
      }),
    ).toBe('')
  })
})

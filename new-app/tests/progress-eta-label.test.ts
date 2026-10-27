import { describe, expect, it } from 'vitest'
import {
  CLIP_QUEUE_ERROR_ELAPSED_SEC,
  CLIP_QUEUE_WARN_ELAPSED_SEC,
  clipQueueAttention,
  formatClipProgressEtaLine,
  isClipWaitingForWorker,
} from '@/lib/clips/progress-eta-label'

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

  it('escalates queue attention when waitingForWorker and elapsed time grows', () => {
    expect(
      clipQueueAttention({
        waitingForWorker: true,
        status: 'QUEUED',
        stage: 'queued',
        progress: 0,
        queuedElapsedSec: 30,
      }),
    ).toBe('waiting')
    expect(
      clipQueueAttention({
        waitingForWorker: true,
        status: 'QUEUED',
        stage: 'queued',
        progress: 0,
        queuedElapsedSec: CLIP_QUEUE_WARN_ELAPSED_SEC + 5,
      }),
    ).toBe('slow')
    expect(
      clipQueueAttention({
        waitingForWorker: true,
        status: 'QUEUED',
        stage: 'queued',
        progress: 0,
        queuedElapsedSec: CLIP_QUEUE_ERROR_ELAPSED_SEC + 1,
      }),
    ).toBe('stalled')
    expect(
      formatClipProgressEtaLine({
        etaSec: 0,
        progress: 0,
        status: 'QUEUED',
        stage: 'queued',
        waitingForWorker: true,
        queueAhead: 0,
        queuedElapsedSec: CLIP_QUEUE_ERROR_ELAPSED_SEC + 60,
      }),
    ).toContain('Still waiting for a worker')
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

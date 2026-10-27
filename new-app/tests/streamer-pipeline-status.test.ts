import { describe, expect, it } from 'vitest'
import { resolveStreamPipelinePhase, streamPipelineLabel } from '@/lib/server/streamer/pipeline-status'

describe('resolveStreamPipelinePhase', () => {
  it('maps autopull wait', () => {
    expect(
      resolveStreamPipelinePhase({
        status: 'QUEUED',
        stage: 'queued',
        triggeredBy: 'auto',
        waitingForWorker: true,
        pendingAutopull: true,
      }),
    ).toBe('waiting_replay')
    expect(streamPipelineLabel('waiting_replay')).toBe('Waiting for replay')
    expect(streamPipelineLabel('waiting_replay', { platform: 'kick' })).toBe(
      'Waiting for Kick to publish your replay',
    )
  })

  it('maps live rolling to live_clipping', () => {
    expect(
      resolveStreamPipelinePhase({
        status: 'PREPARING',
        stage: 'Live clipping',
        triggeredBy: 'auto',
        liveRolling: true,
      }),
    ).toBe('live_clipping')
  })

  it('maps rendering to clipping', () => {
    expect(
      resolveStreamPipelinePhase({
        status: 'RENDERING',
        stage: 'Rendering clips',
        triggeredBy: 'paste',
      }),
    ).toBe('clipping')
  })
})

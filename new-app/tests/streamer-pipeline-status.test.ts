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

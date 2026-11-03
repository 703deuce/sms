import { describe, expect, it } from 'vitest'
import {
  EXPORT_RENDER_JOB_TYPES,
  skipClipProjectPatchForWorkerProgress,
} from '@/lib/server/clips/job-progress'

describe('REGRESSION_BATCH1b §A export failure scope', () => {
  it('RENDER_CLIP progress never patches clip_projects', () => {
    expect(EXPORT_RENDER_JOB_TYPES.has('RENDER_CLIP')).toBe(true)
    expect(
      skipClipProjectPatchForWorkerProgress({
        jobType: 'RENDER_CLIP',
        projectSourceKind: 'upload',
      }),
    ).toBe(true)
    expect(
      skipClipProjectPatchForWorkerProgress({
        jobType: 'PROCESS_PROJECT',
        projectSourceKind: 'upload',
      }),
    ).toBe(false)
  })
})

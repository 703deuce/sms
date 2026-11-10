import {describe,expect,it} from 'vitest'
import {
  UNIFIED_CLIP_INSTRUCTION,
  buildUnifiedClipRunInput,
  storyTargetFromAgentSeconds,
} from '@/lib/ai-producer-agent/clip-mode/unified-run-input'

describe('shared unified clip run entry point',()=>{
  it('builds one clip_unified_v1 job for a regular upload source',()=>{
    const input=buildUnifiedClipRunInput({
      source:{
        sourceId:'uploaded_recording',kind:'upload',projectId:'proj_1',
        rangeMs:[0,1_200_000],title:'Interview',
      },
      targetLengthS:storyTargetFromAgentSeconds(60),
    })
    expect(input.storyMode).toBe('clip_unified_v1')
    expect(input.outputType).toBe('story')
    expect(input.sources).toHaveLength(1)
    expect(input.sources[0]).toMatchObject({
      kind:'upload',projectId:'proj_1',rangeMs:[0,1_200_000],durationMs:1_200_000,
    })
    expect(input.targetLengthS).toEqual([50,70])
    expect(input.exportOnFinish).toBe(true)
    expect(input.visualEvidenceMode).toBe('visual_audio')
    expect(input.instruction).toBe(UNIFIED_CLIP_INSTRUCTION)
  })

  it('uses the same entry point for a later stream window (kind=stream)',()=>{
    const input=buildUnifiedClipRunInput({
      source:{
        sourceId:'stream_recording',kind:'stream',projectId:'proj_window',
        rangeMs:[1_200_000,2_400_000],
      },
      targetLengthS:storyTargetFromAgentSeconds(30),
    })
    expect(input.storyMode).toBe('clip_unified_v1')
    expect(input.sources).toHaveLength(1)
    expect(input.sources[0]).toMatchObject({
      kind:'stream',projectId:'proj_window',rangeMs:[1_200_000,2_400_000],
      durationMs:1_200_000,
    })
    expect(input.targetLengthS).toEqual([20,40])
  })
})

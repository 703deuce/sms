import {describe,expect,it} from 'vitest'
import {skipClipProjectPatchForWorkerProgress} from '@/lib/server/clips/job-progress'

describe('AI agent jobs must not fail their original source',()=>{
  for(const jobType of ['AI_PRODUCER_AGENT_ANALYZE','AI_PRODUCER_AGENT_RUN','STREAM_AGENT_BATCH']){
    it('keeps READY source intact for '+jobType,()=>{
      expect(skipClipProjectPatchForWorkerProgress({jobType})).toBe(true)
    })
  }
  it('keeps PROCESS_PROJECT authoritative for original source',()=>{
    expect(skipClipProjectPatchForWorkerProgress({jobType:'PROCESS_PROJECT'})).toBe(false)
  })
})

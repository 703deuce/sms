import {beforeEach,describe,expect,it,vi} from 'vitest'
import {
  planAutoStartUnifiedClip,
  shouldHookAutoStartUnified,
  type AutoStartProjectSnap,
} from '@/lib/streamer/auto-start-unified'

const findUnique=vi.fn()
const executeRaw=vi.fn()
const startUnifiedClipRun=vi.fn()
const createAiProducerAgentRun=vi.fn()
let agentEnabled=true

vi.mock('@/lib/server/db',()=>({
  getPrisma:()=>({
    clipProject:{findUnique},
    $executeRaw:(...args:unknown[])=>executeRaw(...args),
  }),
}))
vi.mock('@/lib/server/ai-producer-agent/unified-clip-run',()=>({
  startUnifiedClipRun:(...args:unknown[])=>startUnifiedClipRun(...args),
}))
vi.mock('@/lib/server/ai-producer-agent/runs',()=>({
  createAiProducerAgentRun:(...args:unknown[])=>createAiProducerAgentRun(...args),
}))
vi.mock('@/lib/server/streamer/agent-window-source',()=>({createAgentVideoWindow:vi.fn()}))
vi.mock('@/lib/ai-producer-agent/flags',()=>({aiProducerAgentServerEnabled:()=>agentEnabled}))

function streamProject(extra:Partial<AutoStartProjectSnap>={}):AutoStartProjectSnap{
  return {
    id:'proj_stream',status:'READY',deletedAt:null,uploadId:'upl_1',
    settings:{},rangeStartMs:0,rangeEndMs:3_600_000,title:'Stream night',
    transcriptKey:'ws/proj/words.json',
    streamVod:{platform:'twitch',attestedAt:new Date('2026-11-10T00:00:00Z'),channel:null},
    ...extra,
  }
}

describe('post-ingest hook gate',()=>{
  it('fires for upload and stream ingest jobs that reach READY',()=>{
    expect(shouldHookAutoStartUnified('PROCESS_PROJECT','READY','DONE')).toBe(true)
    expect(shouldHookAutoStartUnified('STREAM_ANALYZE','READY','DONE')).toBe(true)
    expect(shouldHookAutoStartUnified('STREAM_RENDER','READY','DONE')).toBe(true)
  })
  it('ignores non-ingest jobs and non-final progress',()=>{
    expect(shouldHookAutoStartUnified('STREAM_IMPORT','QUEUED','DONE')).toBe(false)
    expect(shouldHookAutoStartUnified('STREAM_ANALYZE','RENDERING','DONE')).toBe(false)
    expect(shouldHookAutoStartUnified('STREAM_RENDER','READY','RUNNING')).toBe(false)
    expect(shouldHookAutoStartUnified('RENDER_CLIP','READY','DONE')).toBe(false)
    expect(shouldHookAutoStartUnified('STREAM_AGENT_BATCH','READY','DONE')).toBe(false)
  })
})

describe('planAutoStartUnifiedClip (stream)',()=>{
  it('plans one kind=stream unified job on the full imported range',()=>{
    const plan=planAutoStartUnifiedClip(streamProject())
    expect(plan).toEqual({
      source:{sourceId:'stream_recording',kind:'stream',projectId:'proj_stream',
        rangeMs:[0,3_600_000],durationMs:3_600_000,title:'Stream night'},
      targetLengthS:[50,70],
    })
  })
  it('uses an existing window project range as-is',()=>{
    const plan=planAutoStartUnifiedClip(streamProject({
      id:'proj_window',rangeStartMs:1_200_000,rangeEndMs:2_400_000,
      streamVod:{platform:'kick',attestedAt:null,channel:{status:'CONNECTED',deletedAt:null}},
      settings:{autoAgentClipSeconds:30},
    }))
    expect(plan?.source).toMatchObject({kind:'stream',projectId:'proj_window',
      rangeMs:[1_200_000,2_400_000],durationMs:1_200_000})
    expect(plan?.targetLengthS).toEqual([20,40])
  })
  it('does not need an upload auto-agent mode for Twitch/Kick',()=>{
    expect(planAutoStartUnifiedClip(streamProject({settings:{}}))).not.toBeNull()
  })
  it('skips when a batch or unified run already exists',()=>{
    expect(planAutoStartUnifiedClip(streamProject({settings:{unifiedClipRunId:'run_1'}}))).toBeNull()
    expect(planAutoStartUnifiedClip(streamProject({settings:{agentClipBatch:{id:'b'}}}))).toBeNull()
  })
  it('skips audio-only, untranscribed, unpermitted, not-ready, or tiny sources',()=>{
    expect(planAutoStartUnifiedClip(streamProject({uploadId:null}))).toBeNull()
    expect(planAutoStartUnifiedClip(streamProject({transcriptKey:null,transcriptWords:[]}))).toBeNull()
    expect(planAutoStartUnifiedClip(streamProject({
      streamVod:{platform:'twitch',attestedAt:null,channel:{status:'DISCONNECTED'}}}))).toBeNull()
    expect(planAutoStartUnifiedClip(streamProject({status:'RENDERING'}))).toBeNull()
    expect(planAutoStartUnifiedClip(streamProject({deletedAt:new Date()}))).toBeNull()
    expect(planAutoStartUnifiedClip(streamProject({rangeEndMs:10_000}))).toBeNull()
  })
  it('keeps uploads gated on autoAgentClipMode',()=>{
    const upload=streamProject({streamVod:null,settings:{}})
    expect(planAutoStartUnifiedClip(upload)).toBeNull()
    expect(planAutoStartUnifiedClip({...upload,settings:{autoAgentClipMode:'clip_story_v1'}})?.source)
      .toMatchObject({kind:'upload',sourceId:'uploaded_recording'})
  })
})

describe('maybeAutoStartUploadAgentBatch (mocked stream ingest)',()=>{
  beforeEach(()=>{
    findUnique.mockReset();executeRaw.mockReset()
    startUnifiedClipRun.mockReset();createAiProducerAgentRun.mockReset()
    agentEnabled=true
  })

  it('starts one clip_unified_v1 run (kind=stream) and records its id, no batch',async()=>{
    const {id:_id,...row}=streamProject()
    findUnique.mockResolvedValueOnce({workspaceId:'ws_1',...row})
    startUnifiedClipRun.mockResolvedValueOnce({id:'aprun_stream'})
    executeRaw.mockResolvedValueOnce(1)
    const {maybeAutoStartUploadAgentBatch}=await import('@/lib/server/streamer/agent-batch')
    const run=await maybeAutoStartUploadAgentBatch('proj_stream')
    expect(run).toEqual({id:'aprun_stream'})
    expect(startUnifiedClipRun).toHaveBeenCalledTimes(1)
    expect(startUnifiedClipRun).toHaveBeenCalledWith('ws_1',{
      source:expect.objectContaining({kind:'stream',projectId:'proj_stream',rangeMs:[0,3_600_000]}),
      targetLengthS:[50,70],
    })
    expect(createAiProducerAgentRun).not.toHaveBeenCalled()
    expect(executeRaw).toHaveBeenCalledTimes(1)
  })

  it('does nothing for a stream while the agent is disabled',async()=>{
    agentEnabled=false
    const {id:_id,...row}=streamProject()
    findUnique.mockResolvedValueOnce({workspaceId:'ws_1',...row})
    const {maybeAutoStartUploadAgentBatch}=await import('@/lib/server/streamer/agent-batch')
    expect(await maybeAutoStartUploadAgentBatch('proj_stream')).toBeNull()
    expect(startUnifiedClipRun).not.toHaveBeenCalled()
    expect(executeRaw).not.toHaveBeenCalled()
  })

  it('records a start error once without throwing',async()=>{
    const {id:_id,...row}=streamProject()
    findUnique.mockResolvedValueOnce({workspaceId:'ws_1',...row})
    startUnifiedClipRun.mockRejectedValueOnce(new Error('project_source_missing'))
    executeRaw.mockResolvedValueOnce(1)
    const spy=vi.spyOn(console,'error').mockImplementation(()=>{})
    const {maybeAutoStartUploadAgentBatch}=await import('@/lib/server/streamer/agent-batch')
    expect(await maybeAutoStartUploadAgentBatch('proj_stream')).toBeNull()
    expect(executeRaw).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
})

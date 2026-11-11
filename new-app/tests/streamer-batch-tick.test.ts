import {beforeEach,describe,expect,it,vi} from 'vitest'

const {findUnique,findFirst,findMany,findUniqueOrThrow,update,createJob,
  startUnifiedClipRun,createAiProducerAgentRun}=vi.hoisted(()=>({
  findUnique:vi.fn(),findFirst:vi.fn(),findMany:vi.fn(),findUniqueOrThrow:vi.fn(),
  update:vi.fn(),createJob:vi.fn(),startUnifiedClipRun:vi.fn(),createAiProducerAgentRun:vi.fn(),
}))
const prisma={
  clipProject:{findUnique,findUniqueOrThrow,update},
  aiProducerAgentRun:{findFirst},
  clip:{findMany},
  clipJob:{create:createJob},
  $transaction:async (fn:(tx:unknown)=>Promise<unknown>)=>fn(prisma),
}
vi.mock('@/lib/server/db',()=>({getPrisma:()=>prisma}))
vi.mock('@/lib/supabase/id',()=>({createId:()=> 'mock_id'}))
vi.mock('@/lib/server/streamer/agent-window-source',()=>({createAgentVideoWindow:vi.fn()}))
vi.mock('@/lib/server/ai-producer-agent/runs',()=>({
  createAiProducerAgentRun:(...args:unknown[])=>createAiProducerAgentRun(...args),
}))
vi.mock('@/lib/server/ai-producer-agent/unified-clip-run',()=>({
  startUnifiedClipRun:(...args:unknown[])=>startUnifiedClipRun(...args),
}))
vi.mock('@/lib/ai-producer-agent/flags',()=>({aiProducerAgentServerEnabled:()=>true}))

import {tickStreamerAgentBatch} from '@/lib/server/streamer/agent-batch'

const batch={
  id:'batch_1',status:'running',mode:'clip_unified_v1' as const,
  seconds:60 as const,index:0,total:1,sourceStartMs:0,
  sourceDurationMs:60_000,runId:'run_1',
  completed:[],errors:[],startedAt:'2026-11-11T00:00:00Z',
}
describe('CL12 actual durable streamer batch tick',()=>{
  beforeEach(()=>{
    vi.clearAllMocks()
    findUnique.mockResolvedValue({
      id:'source',workspaceId:'ws_1',uploadId:'uploaded',
      streamVod:null,settings:{agentClipBatch:batch},
    })
    findUniqueOrThrow.mockResolvedValue({settings:{agentClipBatch:batch}})
    update.mockResolvedValue({})
    findFirst.mockResolvedValue({
      status:'done',resultProjectId:'output_1',
      outputProjectIds:['output_1'],resultClipId:'lead',
      producerNotes:{publishedClipIds:['lead','story','moment','story','foreign']},
    })
    // Return deliberately reverse order to prove provider/database row order
    // cannot silently reorder published output bookkeeping.
    findMany.mockResolvedValue([
      {id:'moment',projectId:'output_1'},
      {id:'story',projectId:'output_1'},
      {id:'lead',projectId:'output_1'},
    ])
  })
  it('persists every authorized live published result exactly once, no second paid run',async()=>{
    expect(await tickStreamerAgentBatch('source','batch_1'))
      .toMatchObject({status:'done',index:1,total:1})
    expect(findMany).toHaveBeenCalledWith({where:{
      id:{in:['lead','story','moment','foreign']},
      projectId:{in:['output_1']},workspaceId:'ws_1',deletedAt:null,
    },select:{id:true,projectId:true}})
    const saved=update.mock.calls[0]?.[0]?.data?.settings?.agentClipBatch
    expect(saved.completed.map((item:{clipId:string})=>item.clipId))
      .toEqual(['lead','story','moment'])
    expect(saved.status).toBe('done')
    expect(createJob).not.toHaveBeenCalled()
    expect(startUnifiedClipRun).not.toHaveBeenCalled()
    expect(createAiProducerAgentRun).not.toHaveBeenCalled()
  })
  it('retains saved clips when run terminates with no extra published output',async()=>{
    findFirst.mockResolvedValueOnce({status:'failed',error:'agent_failed'})
    findUnique.mockResolvedValueOnce({
      id:'source',workspaceId:'ws_1',uploadId:'uploaded',streamVod:null,
      settings:{agentClipBatch:{...batch,completed:[{
        projectId:'output_1',clipId:'saved',startMin:0,
      }]}},
    })
    findUniqueOrThrow.mockResolvedValueOnce({settings:{agentClipBatch:batch}})
    expect(await tickStreamerAgentBatch('source','batch_1'))
      .toMatchObject({status:'done'})
    const saved=update.mock.calls[0]?.[0]?.data?.settings?.agentClipBatch
    expect(saved.completed.map((item:{clipId:string})=>item.clipId))
      .toEqual(['saved'])
    expect(saved.errors).toHaveLength(1)
    expect(startUnifiedClipRun).not.toHaveBeenCalled()
  })
})

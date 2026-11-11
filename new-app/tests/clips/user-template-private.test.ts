import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state, db } = vi.hoisted(() => {
  const state = {
    sourceClips: [] as Record<string, any>[],
    uploads: [] as Record<string, any>[],
    templates: [] as Record<string, any>[],
    revisions: [] as Record<string, any>[],
    projects: [] as Record<string, any>[],
    createdClips: [] as Record<string, any>[],
    media: [] as Record<string, any>[],
  }
  const clip = {
    findFirst: vi.fn(async ({ where }: any) =>
      state.sourceClips.find(c => c.id === where.id && c.workspaceId === where.workspaceId && c.deletedAt === null) ?? null),
    create: vi.fn(async ({ data }: any) => {
      const row={...data,deletedAt:null};state.createdClips.push(row);return row
    }),
  }
  const clipUpload = {
    count: vi.fn(async ({ where }: any) => state.uploads.filter(u =>
      u.workspaceId===where.workspaceId && u.status===where.status && where.id.in.includes(u.id)).length),
    findMany: vi.fn(async ({ where }: any) => state.uploads.filter(u =>
      u.workspaceId===where.workspaceId && u.status===where.status && where.id.in.includes(u.id))
      .map(({id,filename,mime,durationMs,width,height})=>({id,filename,mime,durationMs,width,height}))),
  }
  const clipUserTemplate = {
    create: vi.fn(async ({ data }: any) => {
      const row={...data,createdAt:new Date(),updatedAt:new Date(),deletedAt:null};state.templates.push(row);return row
    }),
    findFirst: vi.fn(async ({ where, select }: any) => {
      const row=state.templates.find(t => t.id===where.id && t.workspaceId===where.workspaceId && t.deletedAt===null)
      if(!row)return null
      if(!select)return row
      return Object.fromEntries(Object.keys(select).filter(k=>select[k]).map(k=>[k,row[k]]))
    }),
    update: vi.fn(async ({ where, data }: any) => {
      const row=state.templates.find(t=>t.id===where.id)!
      Object.assign(row,data,{updatedAt:new Date()});return row
    }),
    count: vi.fn(async ({ where }: any) => state.templates.filter(t=>t.workspaceId===where.workspaceId&&!t.deletedAt).length),
    findMany: vi.fn(async ({ where }: any) => state.templates.filter(t=>t.workspaceId===where.workspaceId&&!t.deletedAt)),
  }
  const clipUserTemplateRevision = {
    create: vi.fn(async ({ data }: any) => {
      const row={...data,createdAt:new Date()};state.revisions.push(row);return row
    }),
    findFirst: vi.fn(async ({ where }: any) => state.revisions.find(r =>
      r.templateId===where.templateId && r.workspaceId===where.workspaceId && r.revision===where.revision) ?? null),
  }
  const clipProject = {
    create: vi.fn(async ({ data }: any) => {const row={...data};state.projects.push(row);return row}),
  }
  const clipProjectMedia = {
    create: vi.fn(async ({ data }: any) => {const row={...data};state.media.push(row);return row}),
  }
  const tx:any={clip,clipUserTemplate,clipUserTemplateRevision,clipProject,clipProjectMedia}
  const db:any={
    ...tx,clipUpload,
    clipFont:{count:vi.fn(async()=>0)},
    aiGeneration:{count:vi.fn(async()=>0)},
    $transaction:vi.fn(async (cb:any)=>cb(tx)),
  }
  return {state,db}
})
vi.mock('server-only',()=>({}))
vi.mock('@/lib/server/db',()=>({getPrisma:()=>db}))

import {
  addUserTemplateRevision,
  createPrivateUserTemplate,
  getPrivateUserTemplate,
  inspectClipForUserTemplate,
  usePrivateUserTemplate,
} from '@/lib/server/clips/user-templates'

const originalEdits=()=>({
  v:2,
  trim:{in:0,out:6000},
  cutRanges:[],
  wordFixes:{},
  captions:{},
  layout:{mode:'full_frame',shotOverrides:[]},
  sources:[{id:'src_cam',ref:'upload',refId:'source_src',mediaType:'video',durationMs:5000,label:'Second camera'}],
  sourceSegments:[{
    sourceId:'src_cam',startMs:2000,endMs:4000,inMs:250,
    transform:{scale:108,x:3,y:-2},fx:{contrast:6},
    playback:{outputFrames:60,pieces:[{kind:'play',frames:30,rate:1},{kind:'hold',frames:30}]},
  }],
  transitions:[{srcMs:2000,type:'crossfade',durMs:180}],
  textItems:[{
    id:'headline',text:'Original headline',startMs:200,endMs:2200,x:50,y:20,
    style:{font:'Montserrat',size:96,color:'#FFFFFF',align:'center',case:'none'},
  }],
  keyframes:[{target:'text:headline',prop:'x',frames:[{ms:200,value:45},{ms:700,value:50}]}],
  broll:[],
  audio:{music:null,sfx:[]},
  aspectRatio:'9:16',
})

function seed(){
  state.uploads.push(
    {id:'main_src',workspaceId:'ws_one',status:'COMPLETE',filename:'Main.mp4',mime:'video/mp4',durationMs:8000,width:1080,height:1920},
    {id:'source_src',workspaceId:'ws_one',status:'COMPLETE',filename:'Second.mp4',mime:'video/mp4',durationMs:5000,width:1080,height:1920},
    {id:'fill_main',workspaceId:'ws_one',status:'COMPLETE',filename:'Replacement main.mp4',mime:'video/mp4',durationMs:9000,width:1080,height:1920},
    {id:'fill_source',workspaceId:'ws_one',status:'COMPLETE',filename:'Replacement second.mp4',mime:'video/mp4',durationMs:6000,width:1080,height:1920},
    {id:'foreign_fill',workspaceId:'ws_two',status:'COMPLETE',filename:'Foreign.mp4',mime:'video/mp4',durationMs:9000,width:1080,height:1920},
  )
  state.sourceClips.push({
    id:'clip_source',workspaceId:'ws_one',deletedAt:null,startMs:0,endMs:6000,title:'Source edit',
    editsSaveVersion:12,edits:originalEdits(),
    project:{id:'project_source',workspaceId:'ws_one',uploadId:'main_src',settings:{},
      upload:{id:'main_src',filename:'Main.mp4',mime:'video/mp4',durationMs:8000,status:'COMPLETE'}},
  })
}
const saveInput=()=>({
  clipId:'clip_source',title:'Reusable edit',description:'Private reusable sequence',
  replaceableItemKeys:['main','source:src_cam'],
  editableTextIds:['headline'],decorativeAssetKeys:[],
  musicPolicy:'mute' as const,previewRange:{startMs:0,endMs:5000},
})

beforeEach(()=>{
  for(const list of Object.values(state)) if(Array.isArray(list)) list.length=0
  vi.clearAllMocks()
  seed()
})

describe('Batch 15 private save/revision/reuse',()=>{
  it('inspects only workspace-owned source structure and exposes explicit slot/text choices',async()=>{
    const inspect=await inspectClipForUserTemplate('ws_one','clip_source')
    expect(inspect.replaceable.map(x=>x.key)).toEqual(['main','source:src_cam'])
    expect(inspect.textFields).toEqual([expect.objectContaining({id:'headline',text:'Original headline'})])
    expect(inspect.editsSaveVersion).toBe(12)
    await expect(inspectClipForUserTemplate('ws_two','clip_source')).rejects.toThrow(/Clip not found/)
  })

  it('saves a private immutable definition without mutating or retaining the source project pointer',async()=>{
    const before=structuredClone(state.sourceClips[0]!.edits)
    const made=await createPrivateUserTemplate('ws_one','creator',saveInput())
    expect(state.sourceClips[0]!.edits).toEqual(before)
    expect(state.templates).toHaveLength(1)
    expect(state.revisions).toHaveLength(1)
    const revision=state.revisions[0]!
    expect(revision.revision).toBe(1)
    expect(revision.definition.snapshot.edits.sources[0]).toMatchObject({
      id:'template_source_2',ref:'upload',refId:'template_slot_2',
    })
    expect(JSON.stringify(revision.definition)).not.toContain('project_source')
    expect(JSON.stringify(revision.definition)).not.toContain('source_src')
    expect(revision.definition.textFields[0]).toMatchObject({itemId:'headline',exampleText:'Original headline'})
    expect(made.revisionId).toBe(revision.id)
  })

  it('appends immutable revisions while old revisions remain retrievable',async()=>{
    const made=await createPrivateUserTemplate('ws_one','creator',saveInput())
    const old=structuredClone(state.revisions[0]!.definition)
    state.sourceClips[0]!.edits.textItems[0].text='Revision two headline'
    state.sourceClips[0]!.editsSaveVersion=13
    const next=await addUserTemplateRevision('ws_one','creator',made.id,{...saveInput(),title:'Reusable edit v2'})
    expect(next.revision).toBe(2)
    expect(state.revisions).toHaveLength(2)
    expect(state.revisions[0]!.definition).toEqual(old)
    expect((await getPrivateUserTemplate('ws_one',made.id,1)).revision.revision).toBe(1)
    expect((await getPrivateUserTemplate('ws_one',made.id,2)).revision.revision).toBe(2)
  })

  it('creates a new normal editable project from a pinned revision and leaves the original untouched',async()=>{
    const before=structuredClone(state.sourceClips[0]!.edits)
    const made=await createPrivateUserTemplate('ws_one','creator',saveInput())
    const used=await usePrivateUserTemplate('ws_one','user_two',made.id,{
      revision:1,fills:{slot_1:'fill_main',slot_2:'fill_source'},text:{field_headline:'New headline'},
    })
    expect(state.sourceClips[0]!.edits).toEqual(before)
    expect(state.projects).toHaveLength(1)
    expect(state.createdClips).toHaveLength(1)
    const created=state.createdClips[0]!
    expect(created.projectId).toBe(used.projectId)
    expect(created.id).toBe(used.clipId)
    expect(created.edits.sources[0]).toMatchObject({id:'template_source_2',refId:'fill_source'})
    expect(created.edits.sourceSegments[0]).toMatchObject({
      sourceId:'template_source_2',transform:{scale:108,x:3,y:-2},fx:{contrast:6},
      playback:{outputFrames:60},
    })
    expect(created.edits.transitions).toEqual([{srcMs:2000,type:'crossfade',durMs:180}])
    expect(created.edits.textItems[0].text).toBe('New headline')
    expect(created.edits.keyframes[0]).toMatchObject({target:'text:headline',prop:'x'})
    expect(created.aiMeta.userTemplate).toMatchObject({templateId:made.id,revision:1})
    expect(state.media.some(m=>m.uploadId==='fill_source')).toBe(true)
  })

  it('rejects cross-workspace template access and foreign slot media',async()=>{
    const made=await createPrivateUserTemplate('ws_one','creator',saveInput())
    await expect(getPrivateUserTemplate('ws_two',made.id)).rejects.toThrow(/Template not found/)
    await expect(usePrivateUserTemplate('ws_two','user',made.id,{
      revision:1,fills:{slot_1:'fill_main',slot_2:'fill_source'},
    })).rejects.toThrow(/Template not found/)
    await expect(usePrivateUserTemplate('ws_one','user',made.id,{
      revision:1,fills:{slot_1:'foreign_fill',slot_2:'fill_source'},
    })).rejects.toThrow(/missing or belong to another workspace/)
    expect(state.projects).toHaveLength(0)
    expect(state.createdClips).toHaveLength(0)
  })

  it('rejects incomplete slot filling rather than flattening or silently reusing private source media',async()=>{
    const made=await createPrivateUserTemplate('ws_one','creator',saveInput())
    await expect(usePrivateUserTemplate('ws_one','user',made.id,{
      revision:1,fills:{slot_1:'fill_main'},
    })).rejects.toThrow(/Fill every numbered slot/)
    expect(state.projects).toHaveLength(0)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state, db, getPrivate } = vi.hoisted(() => {
  const state = {
    publications: [] as Record<string, any>[],
    reports: [] as Record<string, any>[],
    audit: [] as Record<string, any>[],
    rateCount: 1,
  }
  const publication = {
    findFirst: vi.fn(async ({ where }: any) => state.publications.find(p =>
      (!where.id || p.id === where.id) &&
      (!where.templateId || p.templateId === where.templateId) &&
      (!where.revisionId || p.revisionId === where.revisionId) &&
      (!where.state || (typeof where.state === 'string' ? p.state === where.state :
        where.state.in?.includes(p.state))) &&
      (where.hiddenAt === undefined || p.hiddenAt === where.hiddenAt) &&
      (where.withdrawnAt === undefined || p.withdrawnAt === where.withdrawnAt)) ?? null),
    findUnique: vi.fn(async ({ where }: any) => state.publications.find(p => p.id === where.id) ?? null),
    findMany: vi.fn(async ({ where }: any) => {
      if (where?.templateId && where?.state === 'published')
        return state.publications.filter(p => p.templateId === where.templateId && p.state === 'published' && p.id !== where.id?.not)
      return state.publications.filter(p => p.state === 'published')
    }),
    count: vi.fn(async ({ where }: any) => state.publications.filter(p => p.state === where.state).length),
    create: vi.fn(async ({ data }: any) => {
      const row = { ...data, createdAt: new Date(), updatedAt: new Date(), hiddenAt: null, withdrawnAt: null }
      state.publications.push(row);return row
    }),
    update: vi.fn(async ({ where, data }: any) => {
      const row = state.publications.find(p => p.id === where.id)!
      Object.assign(row, data);return row
    }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const ids = new Set(where.id.in)
      let count=0
      for(const row of state.publications)if(ids.has(row.id)){Object.assign(row,data);count++}
      return {count}
    }),
  }
  const moderationEvent = {
    count: vi.fn(async () => 0),
    create: vi.fn(async ({ data }: any) => { state.audit.push(data);return data }),
    createMany: vi.fn(async ({ data }: any) => { state.audit.push(...data);return {count:data.length} }),
  }
  const report = {
    findFirst: vi.fn(async ({ where }: any) => state.reports.find(r =>
      r.publicationId===where.publicationId&&r.reporterUserId===where.reporterUserId&&r.status===where.status) ?? null),
    create: vi.fn(async ({ data }: any) => { const row={...data,createdAt:new Date()};state.reports.push(row);return row }),
    updateMany: vi.fn(async () => ({count:0})),
  }
  const rate = { upsert: vi.fn(async () => ({count:state.rateCount})) }
  const tx:any={clipTemplatePublication:publication,clipTemplateModerationEvent:moderationEvent,clipTemplateReport:report}
  const db:any={...tx,clipTemplateRateLimit:rate,$transaction:vi.fn(async (cb:any)=>cb(tx))}
  const getPrivate=vi.fn()
  return {state,db,getPrivate}
})
vi.mock('server-only',()=>({}))
vi.mock('@/lib/server/db',()=>({getPrisma:()=>db}))
vi.mock('@/lib/server/clips/user-templates',()=>({
  getPrivateUserTemplate:getPrivate,
  usePrivateUserTemplate:vi.fn(),
}))
vi.mock('@/lib/server/auth/session',()=>({getAuthenticatedUser:vi.fn()}))

import {
  getPublishedCommunityTemplate,
  moderateCommunityTemplate,
  reportCommunityTemplate,
  searchCommunityTemplates,
  submitUserTemplateForReview,
} from '@/lib/server/clips/user-template-community'

function publicRevision(){
  const slots=[{id:'slot_1',ordinal:1,label:'Main',media:'video',target:{kind:'main'},minDurationMs:3000}]
  return {
    id:'tpl_1',createdById:'creator',title:'Private title',description:'Private',
    currentRevision:1,updatedAt:new Date(),
    revision:{
      id:'rev_1',templateId:'tpl_1',workspaceId:'ws_1',revision:1,createdById:'creator',
      sourceFingerprint:'fingerprint_private',createdAt:new Date(),
      definition:{
        v:1,snapshot:{edits:{v:2,trim:{in:0,out:3000},cutRanges:[],wordFixes:{},captions:{},
          layout:{mode:'full_frame',shotOverrides:[]},sources:[],sourceSegments:[],transitions:[],
          textItems:[],broll:[],keyframes:[],audio:{music:null,sfx:[]}},
          editsSaveVersion:4,clipStartMs:0,clipEndMs:3000,aspect:'9:16'},
        slots,textFields:[],previewRange:{startMs:0,endMs:3000},
        capabilities:{transitions:false,keyframes:false,sourcePlayback:false,textLayers:false,graphics:false,music:false},
      },
      assetManifest:{v:1,slots,decorative:[],musicPolicy:'mute'},
    },
  }
}
const submitInput={
  title:'Public title',description:'A safe description',category:'social',tags:['vertical'],
  creatorName:'Creator',licenseTerms:'End users may reuse this template structure in exported videos.',
  ownsOrLicensed:true as const,recognizablePeoplePermission:true as const,authorReviewedExampleText:true as const,
}

beforeEach(()=>{
  state.publications.length=0;state.reports.length=0;state.audit.length=0;state.rateCount=1
  vi.clearAllMocks()
  getPrivate.mockResolvedValue(publicRevision())
})

describe('Batch 15 community privacy and moderation lifecycle',()=>{
  it('creates only a sanitized pending publication after explicit consent',async()=>{
    const result=await submitUserTemplateForReview('ws_1','creator','tpl_1',submitInput)
    expect(result.state).toBe('submitted')
    expect(state.publications).toHaveLength(1)
    const row=state.publications[0]!
    expect(row.state).toBe('submitted')
    expect(row.publicPreview).toMatchObject({kind:'sanitized-demo-placeholders'})
    expect(JSON.stringify(row.publicDefinition)).not.toContain('fingerprint_private')
    expect(JSON.stringify(row.publicDefinition)).not.toMatch(/sourceProjectId|storageKey|signed/i)
    expect(state.audit[0]).toMatchObject({actorRole:'creator',action:'submitted'})
  })

  it('requires the private template creator and all public rights confirmations',async()=>{
    getPrivate.mockResolvedValueOnce({...publicRevision(),createdById:'teammate'})
    await expect(submitUserTemplateForReview('ws_1','creator','tpl_1',submitInput))
      .rejects.toThrow(/Only the template creator/)
    await expect(submitUserTemplateForReview('ws_1','creator','tpl_1',{...submitInput,ownsOrLicensed:false as never}))
      .rejects.toThrow(/Confirm ownership/)
    expect(state.publications).toHaveLength(0)
  })

  it('keeps pending, hidden and taken-down records out of public lookup',async()=>{
    for(const stateName of ['submitted','hidden','takedown']){
      state.publications=[{id:'pub_1',state:stateName,hiddenAt:stateName==='submitted'?null:new Date(),withdrawnAt:null}]
      await expect(getPublishedCommunityTemplate('pub_1')).rejects.toThrow(/not found/)
    }
    state.publications=[{id:'pub_1',state:'published',hiddenAt:null,withdrawnAt:null,title:'T'}]
    await expect(getPublishedCommunityTemplate('pub_1')).resolves.toMatchObject({id:'pub_1'})
  })

  it('queries public search fail-closed on published/non-hidden/non-withdrawn records',async()=>{
    await searchCommunityTemplates({q:'safe',category:'social',aspect:'9:16',page:1})
    const where=db.clipTemplatePublication.count.mock.calls[0][0].where
    expect(where).toMatchObject({state:'published',hiddenAt:null,withdrawnAt:null,category:'social',aspect:'9:16'})
  })

  it('prevents a creator from approving their own submission',async()=>{
    state.publications=[{id:'pub_1',templateId:'tpl_1',state:'submitted',creatorUserId:'creator',
      publicDefinition:{v:1,definition:publicRevision().revision.definition,manifest:publicRevision().revision.assetManifest},
      publishedAt:null}]
    await expect(moderateCommunityTemplate('creator','pub_1',{action:'approve'}))
      .rejects.toThrow(/Creators cannot approve/)
  })

  it('keeps an old publication live until replacement approval then supersedes it atomically',async()=>{
    const bundle={v:1,definition:publicRevision().revision.definition,manifest:publicRevision().revision.assetManifest}
    state.publications=[
      {id:'old_pub',templateId:'tpl_1',state:'published',creatorUserId:'creator',publicDefinition:bundle,publishedAt:new Date('2026-11-01'),hiddenAt:null},
      {id:'new_pub',templateId:'tpl_1',state:'submitted',creatorUserId:'creator',publicDefinition:bundle,publishedAt:null,hiddenAt:null},
    ]
    expect(state.publications[0]!.state).toBe('published')
    await moderateCommunityTemplate('moderator','new_pub',{action:'approve'})
    expect(state.publications.find(p=>p.id==='old_pub')).toMatchObject({state:'superseded'})
    expect(state.publications.find(p=>p.id==='new_pub')).toMatchObject({state:'published'})
    expect(state.audit.some(a=>a.publicationId==='old_pub'&&a.action==='superseded')).toBe(true)
  })

  it('rate-limits reports and does not create one after the limit',async()=>{
    state.rateCount=11
    await expect(reportCommunityTemplate('ws_1','reporter','pub_1',{reason:'spam'}))
      .rejects.toThrow(/Rate limit/)
    expect(state.reports).toHaveLength(0)
  })
})

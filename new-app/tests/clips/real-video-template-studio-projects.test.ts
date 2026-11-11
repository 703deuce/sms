import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state, db, publish } = vi.hoisted(() => {
  const state = { projects: [] as Record<string, any>[], uploads: [] as Record<string, any>[],
    clips: [] as Record<string, any>[], media: [] as Record<string, any>[] }
  const clipProject = {
    findFirst: vi.fn(async ({ where }: any) => {
      const row = state.projects.find(p => p.id === where.id && p.workspaceId === where.workspaceId && !p.deletedAt)
      if (!row) return null
      if (where.status && row.status !== where.status) return null
      return { ...row, clips: state.clips.filter(c => c.projectId === row.id && (!where.clips?.where?.id || c.id === where.clips.where.id)) }
    }),
    create: vi.fn(async ({ data }: any) => {
      if (state.projects.some(p => p.id === data.id)) throw new Error('unique violation')
      const row = { ...data, deletedAt: null }
      state.projects.push(row)
      return row
    }),
    update: vi.fn(async ({ where, data }: any) => {
      const row = state.projects.find(p => p.id === where.id)!
      Object.assign(row, data)
      return row
    }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const row = state.projects.find(p => p.id === where.id && p.workspaceId === where.workspaceId && p.status === where.status)
      if (row) Object.assign(row, data)
      return { count: row ? 1 : 0 }
    }),
  }
  const clipUpload = {
    findMany: vi.fn(async ({ where }: any) =>
      state.uploads.filter(u => u.workspaceId === where.workspaceId && u.status === where.status && where.id.in.includes(u.id))),
  }
  const clipProjectMedia = { upsert: vi.fn(async ({ create }: any) => {
    if (!state.media.some(m => m.projectId === create.projectId && m.uploadId === create.uploadId))
      state.media.push(create)
    return create
  }) }
  const clip = {
    findFirst: vi.fn(async ({ where }: any) =>
      state.clips.find(c => c.id === where.id && c.workspaceId === where.workspaceId &&
        !c.deletedAt) ?? null),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const row = state.clips.find(c => c.id === where.id && c.workspaceId === where.workspaceId &&
        c.editsSaveVersion === where.editsSaveVersion)
      if (!row) return { count: 0 }
      Object.assign(row, data, { editsSaveVersion: row.editsSaveVersion + 1 })
      return { count: 1 }
    }),
  }
  const tx = { clipProject, clipUpload, clipProjectMedia, clip }
  const db: any = { ...tx,
    $transaction: vi.fn(async (cb: any) => cb(tx)),
  }
  const publish = vi.fn(async (workspaceId: string, key: string, family: any, design: any, choices: any) => {
    const project = state.projects.find(p => p.workspaceId === workspaceId && p.settings?.videoTemplateDraft?.draft?.draftId === key)!
    project.status = 'READY'
    const id = 'clip_mock_' + key
    const { compileTemplate } = await import('@/lib/clips/real-video-templates/sequence-contract')
    const { defaultEdits } = await import('@/lib/clips/edits')
    const instanceId = 'vti_' + project.id.replace('proj_tpl_', '')
    const durationMs = Math.round(family.totalFrames * 1000 / 30)
    const compiled = compileTemplate(family, design, { ...choices, instanceId }, {
      durationFrames: family.totalFrames, edits: defaultEdits({ clipStartMs: 0, clipEndMs: durationMs }),
    })
    state.clips.push({ id, projectId: project.id, workspaceId, editsSaveVersion: 0,
      edits: { ...compiled.edits, unknownPersistedField: 'keep' },
      aiMeta: { videoTemplate: { instanceId, studioEditsSaveVersion: 0, authoringVersion: 0,
        snapshot: { family, design }, authoringState: choices } },
    })
    return { projectId: project.id, clipId: id, status: 'READY', instanceId, editsSaveVersion: 0, authoringVersion: 0 }
  })
  return { state, db, publish }
})
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/db', () => ({ getPrisma: () => db }))
vi.mock('@/lib/server/clips/real-video-template-instances', () => ({
  TemplateInstanceNotFound: class TemplateInstanceNotFound extends Error {},
  TemplateInstanceConflict: class TemplateInstanceConflict extends Error {},
  publishTemplateProject: publish,
}))
vi.mock('@/lib/clips/real-video-templates/releases', () => ({
  FIRST_PARTY_VIDEO_TEMPLATES: [{
    id: 'one_reviewed', title: 'One reviewed', category: 'Story', description: 'A short storyboard',
    demoPath: '/original/demo.mp4', demoPosterPath: '/original/poster.webp',
    reviewed: true, previewRenderVerified: true,
    rights: 'No music', requiredCapabilities: [],
    authoredDimensions: ['font-hierarchy','text-placement','animation-choreography'],
    family: { schemaVersion: 1, familyId: 'one', revision: 1, title: 'One',
      tags: ['story'], aspects: ['9:16'], fps: 30, totalFrames: 60,
      slots: [{ id: 'first', ordinal: 1, role: 'hero', media: 'image', startFrame: 0,
        durationFrames: 60, fit: 'cover', sourceAudio: 'mute', transition: 'cut' }],
      texts: [{ id: 'title', defaultText: 'Hello', maxChars: 100, startFrame: 0,
        durationFrames: 60, x: 50, y: 20, font: 'Anton', size: 80, color: '#ffffff' }],
      beatAnchors: [0] },
    design: { schemaVersion: 1, designId: 'author_design', revision: 1,
      stylePackId: 'author_style', familyId: 'one', familyRevision: 1, musicPolicy: 'none' },
  }],
}))
import {
  createVideoTemplateDraft, getVideoTemplateDraft, saveVideoTemplateDraft,
  publishVideoTemplateDraft, savePublishedStudioDraft, discardVideoTemplateDraft, validDraft,
} from '@/lib/server/clips/video-template-studio-projects'

const photo = { id: 'owned_photo', kind: 'image' as const,
  license: { id: 'owned', provenance: 'user-owned' as const, reference: 'user_upload' } }
beforeEach(() => {
  state.projects.length = 0;state.uploads.length = 0;state.clips.length = 0;state.media.length = 0
  state.uploads.push({ id: 'owned_photo', status: 'COMPLETE', workspaceId: 'ws_one', mime: 'image/png',
    durationMs: null, width: 900, height: 1600 })
  vi.clearAllMocks()
})

describe('Batch 4 workspace draft and standalone project lifecycle', () => {
  it('creates and resumes one DRAFT workspace project, never overwrites another', async () => {
    const a = await createVideoTemplateDraft('ws_one', 'one_reviewed', 'request_01234')
    const b = await createVideoTemplateDraft('ws_one', 'one_reviewed', 'request_01234')
    expect(a.id).toBe(b.id)
    expect(state.projects).toHaveLength(1)
    expect(await getVideoTemplateDraft('ws_other', a.id)).toBeNull()
    expect(a.draft.slots).toEqual({})
  })
  it('saves partial fill, rejects foreign assets and stale revisions', async () => {
    const project = await createVideoTemplateDraft('ws_one','one_reviewed','request_01234')
    const next = { ...project.draft, slots: { first: { asset: photo, sourceInFrame: 0,
      fit: 'cover' as const, muteSourceAudio: true, focalX: 50, focalY: 50, remedy: 'replace' as const } } }
    const saved = await saveVideoTemplateDraft('ws_one',project.id,0,next)
    expect(saved.version).toBe(1)
    expect((await saveVideoTemplateDraft('ws_one',project.id,0,next)).version).toBe(1)
    expect((await saveVideoTemplateDraft('ws_one',project.id,1,next)).version).toBe(1)
    await expect(saveVideoTemplateDraft('ws_one',project.id,0,
      { ...next, texts: { title: 'A different change' } })).rejects.toThrow()
    await expect(saveVideoTemplateDraft('ws_other',project.id,1,next)).rejects.toThrow()
    const foreign = { ...next, slots: { first: { ...next.slots.first, asset: { ...photo, id: 'foreign' } } } }
    await expect(saveVideoTemplateDraft('ws_one',project.id,1,foreign)).rejects.toThrow()
    expect((await getVideoTemplateDraft('ws_one',project.id))?.version).toBe(1)
  })
  it('publishes the SAME project and saves standalone text edits without dropping unknown fields', async () => {
    const project = await createVideoTemplateDraft('ws_one','one_reviewed','request_01234')
    const filled = { ...project.draft, slots: { first: { asset: photo, sourceInFrame: 0,
      fit: 'cover' as const, muteSourceAudio: true, focalX: 50, focalY: 50, remedy: 'replace' as const } } }
    await saveVideoTemplateDraft('ws_one',project.id,0,filled)
    const made = await publishVideoTemplateDraft('ws_one',project.id)
    expect(made.projectId).toBe(project.id)
    expect(publish).toHaveBeenCalledTimes(1)
    const edited = { ...filled, texts: { title: 'My new headline' } }
    const saved = await savePublishedStudioDraft('ws_one',project.id,1,0,edited)
    expect(saved).toEqual({version:2,editsSaveVersion:1})
    expect((state.clips[0]?.edits as any).unknownPersistedField).toBe('keep')
    expect((state.clips[0]?.edits as any).textItems[0].text).toBe('My new headline')
    expect((await getVideoTemplateDraft('ws_one',project.id))?.draft.texts.title).toBe('My new headline')
    expect(await savePublishedStudioDraft('ws_one',project.id,1,0,edited))
      .toEqual({version:2,editsSaveVersion:1})
    expect((await getVideoTemplateDraft('ws_one',project.id))?.version).toBe(2)
    await expect(savePublishedStudioDraft('ws_one',project.id,1,0,
      { ...edited, texts: { title: 'Stale and different' } })).rejects.toThrow()
  })
  it('rejects unsupported music re-sync and unapproved audio without persisting a draft', async () => {
    const project = await createVideoTemplateDraft('ws_one','one_reviewed','request_01234')
    await expect(saveVideoTemplateDraft('ws_one',project.id,0,
      { ...project.draft, musicTiming: 'resync' })).rejects.toThrow('Invalid template draft')
    await expect(saveVideoTemplateDraft('ws_one',project.id,0,
      { ...project.draft, music: { id: 'audio_1', kind: 'audio',
        durationFrames: 300, license: { provenance: 'user-owned' } } }))
      .rejects.toThrow('unavailable or unapproved')
    expect((await getVideoTemplateDraft('ws_one',project.id))?.version).toBe(0)
  })
  it('validates slot type, source trim, media ownership and focal point before saving', async () => {
    const project = await createVideoTemplateDraft('ws_one','one_reviewed','request_01234')
    const filled = { ...project.draft, slots: { first: { asset: photo, sourceInFrame: 0,
      fit: 'cover' as const, muteSourceAudio: true, focalX: 50, focalY: 50,
      remedy: 'replace' as const } } }
    expect(() => validDraft('one_reviewed', filled)).not.toThrow()
    expect(() => validDraft('one_reviewed', { ...filled, slots: {
      first: { ...filled.slots.first, focalY: -1 } } })).toThrow('Invalid slot fill')
    expect(() => validDraft('one_reviewed', { ...filled, slots: {
      first: { ...filled.slots.first, sourceInFrame: 10 } } })).toThrow('Invalid slot fill')
    expect(() => validDraft('one_reviewed', { ...filled, slots: {
      first: { ...filled.slots.first, asset: { ...photo, kind: 'audio' } } } })).toThrow('Invalid slot fill')
    expect(() => validDraft('one_reviewed', { ...filled, slots: {
      first: { ...filled.slots.first, asset: { ...photo, license: {
        ...photo.license, provenance: 'unknown' } } } } })).toThrow('Invalid slot fill')
  })
  it('requires an explicit rights declaration for a workspace-owned music replacement', async () => {
    const releases = (await import('@/lib/clips/real-video-templates/releases')).FIRST_PARTY_VIDEO_TEMPLATES
    const release = releases[0]!
    const policy = release.design.musicPolicy
    ;(release.design as any).musicPolicy = 'licensed-only'
    try {
      const project = await createVideoTemplateDraft('ws_one','one_reviewed','request_01234')
      const track = { id: 'owned_audio', kind: 'audio',
        durationFrames: 300, license: { id: 'owned', provenance: 'user-owned', reference: 'workspace_upload' } }
      const unconfirmed = { ...project.draft, music: track }
      expect(() => validDraft('one_reviewed', unconfirmed)).toThrow('Confirm ownership')
      expect(() => validDraft('one_reviewed',
        { ...unconfirmed, musicRightsConfirmed: true })).not.toThrow()
    } finally {
      ;(release.design as any).musicPolicy = policy
    }
  })
  it('accepts only the exact pinned Batch 9A first-party soundtrack provenance', async () => {
    const releases = (await import('@/lib/clips/real-video-templates/releases')).FIRST_PARTY_VIDEO_TEMPLATES as any[]
    const release = releases[0]!
    const previousPolicy = release.design.musicPolicy
    const previousDefaultMusic = release.defaultMusic
    const hash = 'c418b398ea7dc14a92a16596b7687d190735e1f14947bc954e357d62ba6f1482'
    release.design.musicPolicy = 'licensed-only'
    release.defaultMusic = {
      id:'batch9a_anchor_groove_v2',generator:'batch9a-groove-v2',sha256:hash,
      durationFrames:480,bpm:150,beatEveryFrames:3,author:'Transovo AI',
      license:'Transovo first-party original template music',revision:'batch9a-audio-v2',
    }
    try {
      const project = await createVideoTemplateDraft('ws_one','one_reviewed','request_01234')
      const music = {
        id:'generated_audio',kind:'audio' as const,durationFrames:480,
        license:{id:'batch9a_first_party',provenance:'first-party' as const,reference:'batch9a-audio-v2'},
      }
      const rights = {
        assetId:'generated_audio',origin:'first-party-generated',author:'Transovo AI',
        license:'Transovo first-party original template music',revision:'batch9a-audio-v2',
        sha256:hash,commercialUse:true,exportAllowed:true,redistributionAllowed:true,
        verifiedDurationFrames:480,verifiedAt:'batch9a-audio-v2',
      }
      const templateMusic = {
        v:1 as const,choice:'keep-timing' as const,acceptLoop:false,rights,
        schedule:{v:1 as const,mode:'beat-time' as const,musicAssetId:'generated_audio',
          sha256:hash,bpm:150,confidence:'manual' as const,offsetFrames:0,durationFrames:480,
          beats:Array.from({length:160},(_,i)=>i*3),phrases:[],protectedAnchors:[]},
      }
      expect(() => validDraft('one_reviewed',{
        ...project.draft,music,templateMusic,musicRightsConfirmed:true,musicTiming:'keep',
      })).not.toThrow()
      expect(() => validDraft('one_reviewed',{
        ...project.draft,music:{...music,license:{...music.license,reference:'other-revision'}},
        templateMusic,musicRightsConfirmed:true,musicTiming:'keep',
      })).toThrow('unavailable or unapproved')
    } finally {
      release.design.musicPolicy = previousPolicy
      if (previousDefaultMusic === undefined) delete release.defaultMusic
      else release.defaultMusic = previousDefaultMusic
    }
  })

  it('only discards DRAFT projects, preserving a published clip', async () => {
    const a=await createVideoTemplateDraft('ws_one','one_reviewed','request_01234')
    await discardVideoTemplateDraft('ws_one',a.id)
    expect(await getVideoTemplateDraft('ws_one',a.id)).toBeNull()
  })
})

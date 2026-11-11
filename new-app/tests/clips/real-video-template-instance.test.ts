import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state, db } = vi.hoisted(() => {
  const state = {
    uploads: [] as Record<string, any>[],
    projects: [] as Record<string, any>[],
    clips: [] as Record<string, any>[],
    media: [] as Record<string, any>[],
    jobs: [] as Record<string, any>[],
    failClipCreate: false,
  }
  const clipProject = {
    findFirst: vi.fn(async ({ where }: any) => {
      const p = state.projects.find((x) => x.id === where.id && x.workspaceId === where.workspaceId && !x.deletedAt)
      if (!p) return null
      const clips = state.clips
        .filter((c) => c.projectId === p.id && (!where.clips?.where?.id || c.id === where.clips.where.id) && !c.deletedAt)
        .map((c) => ({ id: c.id, editsSaveVersion: c.editsSaveVersion, aiMeta: c.aiMeta }))
      return { id: p.id, status: p.status, clips }
    }),
    create: vi.fn(async ({ data }: any) => {
      const row = { ...data, deletedAt: null }
      state.projects.push(row)
      return row
    }),
    update: vi.fn(async ({ where, data }: any) => {
      const row = state.projects.find((x) => x.id === where.id)
      Object.assign(row!, data)
      return row
    }),
  }
  const clipUpload = {
    findMany: vi.fn(async ({ where }: any) =>
      state.uploads.filter((x) => x.workspaceId === where.workspaceId && x.status === where.status && where.id.in.includes(x.id))
        .map(({ id, mime, durationMs, width, height }) => ({ id, mime, durationMs, width, height }))),
    create: vi.fn(async ({ data }: any) => {
      const row = { ...data }
      state.uploads.push(row)
      return row
    }),
  }
  const clipProjectMedia = {
    create: vi.fn(async ({ data }: any) => {
      state.media.push({ ...data })
      return data
    }),
  }
  const clip = {
    create: vi.fn(async ({ data }: any) => {
      if (state.failClipCreate) throw new Error('simulated clip create failure')
      const row = { ...data, deletedAt: null }
      state.clips.push(row)
      return row
    }),
    findFirst: vi.fn(async ({ where }: any) => {
      const row = state.clips.find((x) => x.id === where.id && x.workspaceId === where.workspaceId && !x.deletedAt)
      return row ? { id: row.id, aiMeta: row.aiMeta } : null
    }),
    update: vi.fn(async ({ where, data }: any) => {
      const row = state.clips.find((x) => x.id === where.id)
      if (!row) throw new Error('missing clip')
      Object.assign(row, data)
      return row
    }),
  }
  const clipJob = {
    create: vi.fn(async ({ data }: any) => {
      const row = { ...data }
      state.jobs.push(row)
      return row
    }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      let count = 0
      for (const row of state.jobs) {
        if (row.projectId === where.projectId && row.status === where.status) {
          Object.assign(row, data)
          count += 1
        }
      }
      return { count }
    }),
  }
  const tx = { clipProject, clipUpload, clipProjectMedia, clip, clipJob }
  const db: any = {
    ...tx,
    $transaction: vi.fn(async (arg: any) => {
      if (typeof arg === 'function') {
        const snapshot = {
          uploads: structuredClone(state.uploads),
          projects: structuredClone(state.projects),
          clips: structuredClone(state.clips),
          media: structuredClone(state.media),
          jobs: structuredClone(state.jobs),
        }
        try {
          return await arg(tx)
        } catch (error) {
          state.uploads.splice(0, state.uploads.length, ...snapshot.uploads)
          state.projects.splice(0, state.projects.length, ...snapshot.projects)
          state.clips.splice(0, state.clips.length, ...snapshot.clips)
          state.media.splice(0, state.media.length, ...snapshot.media)
          state.jobs.splice(0, state.jobs.length, ...snapshot.jobs)
          throw error
        }
      }
      return Promise.all(arg)
    }),
  }
  return { state, db }
})

vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/db', () => ({ getPrisma: () => db }))
vi.mock('@/lib/storage', () => ({
  storageDriverName: () => 's3',
  uploadSourceKey: (workspaceId: string, uploadId: string, ext: string) =>
    'ws/' + workspaceId + '/uploads/' + uploadId + '/source.' + ext,
}))

import {
  cancelTemplateProject,
  publishTemplateProject,
  saveTemplateAuthoringState,
  TemplateAssetUnavailable,
  TemplateInstanceConflict,
} from '@/lib/server/clips/real-video-template-instances'

const family = {
  schemaVersion: 1, familyId: 'one_shot', revision: 1,
  title: 'One still', tags: ['simple'], aspects: ['9:16'], fps: 30, totalFrames: 30,
  slots: [{ id: 'first', ordinal: 1, role: 'hero', media: 'image', startFrame: 0,
    durationFrames: 30, fit: 'cover', sourceAudio: 'mute', transition: 'cut' }],
  texts: [{ id: 'title', defaultText: 'Hello', maxChars: 40, startFrame: 0,
    durationFrames: 30, x: 50, y: 20, font: 'Anton', size: 80, color: '#FFFFFF' }],
  beatAnchors: [],
}
const design = {
  schemaVersion: 1, designId: 'minimal', revision: 1, stylePackId: 'style_a',
  familyId: 'one_shot', familyRevision: 1, musicPolicy: 'none',
}
const photo = {
  id: 'owned_photo', kind: 'image',
  license: { id: 'license_a', provenance: 'user-owned', reference: 'library_a' },
} as const
const choices = { media: { first: photo } }

beforeEach(() => {
  state.uploads.splice(0)
  state.projects.splice(0)
  state.clips.splice(0)
  state.media.splice(0)
  state.jobs.splice(0)
  state.failClipCreate = false
  state.uploads.push({
    id: 'owned_photo', workspaceId: 'ws_a', status: 'COMPLETE', mime: 'image/png',
    durationMs: null, width: 1200, height: 1600,
  })
  vi.clearAllMocks()
})

describe('B3 transactional template project publishing', () => {
  it('atomically publishes a new editable clip and makes retries idempotent', async () => {
    const first = await publishTemplateProject('ws_a', 'request_key_123', family, design, choices)
    const retry = await publishTemplateProject('ws_a', 'request_key_123', family, design, choices)
    expect(retry).toEqual(first)
    expect(db.clipProject.create).toHaveBeenCalledTimes(1)
    expect(db.clip.create).toHaveBeenCalledTimes(1)
    expect(db.clipJob.create).toHaveBeenCalledTimes(1)
    expect(state.media).toHaveLength(1)

    const clip = state.clips[0]!
    expect(clip.edits.sourceSegments).toHaveLength(1)
    expect(clip.edits.textItems?.[0]).toMatchObject({ startMs: 0, endMs: 1000 })
    expect(clip.edits.inserts).toBeUndefined()
    expect(clip.edits.templateProvenance).toMatchObject({
      v: 1, familyId: 'one_shot', familyRevision: 1, designId: 'minimal', designRevision: 1,
    })
    expect(clip.aiMeta.videoTemplate.snapshot.family.revision).toBe(1)
    expect(state.jobs[0]?.payload).toMatchObject({
      blank: true, fullVideo: true, preseededFullVideo: true,
      templateCarrier: true, templateCarrierFrames: 30,
    })
  })

  it('rejects foreign/unavailable assets before exposing a partial project', async () => {
    state.uploads.splice(0)
    await expect(publishTemplateProject('ws_a', 'request_key_123', family, design, choices))
      .rejects.toBeInstanceOf(TemplateAssetUnavailable)
    expect(state.projects).toHaveLength(0)
    expect(state.clips).toHaveLength(0)
    expect(state.jobs).toHaveLength(0)
  })

  it('rolls back every publish row when a mid-transaction write fails', async () => {
    state.failClipCreate = true
    await expect(publishTemplateProject('ws_a', 'request_key_123', family, design, choices))
      .rejects.toThrow(/simulated clip create failure/)
    expect(state.projects).toHaveLength(0)
    expect(state.clips).toHaveLength(0)
    expect(state.media).toHaveLength(0)
    expect(state.jobs).toHaveLength(0)
    expect(state.uploads.filter((row) => row.status === 'PENDING')).toHaveLength(0)
    expect(state.uploads.filter((row) => row.id === 'owned_photo')).toHaveLength(1)
  })

  it('keeps authoring state separate from the authoritative timeline and enforces CAS', async () => {
    const published = await publishTemplateProject('ws_a', 'request_key_123', family, design, choices)
    const originalEdits = structuredClone(state.clips[0]!.edits)
    const saved = await saveTemplateAuthoringState('ws_a', published.clipId, 0, choices)
    expect(saved.authoringVersion).toBe(1)
    expect(state.clips[0]!.edits).toEqual(originalEdits)
    expect(state.clips[0]!.aiMeta.videoTemplate.authoringVersion).toBe(1)
    await expect(saveTemplateAuthoringState('ws_a', published.clipId, 0, choices))
      .rejects.toBeInstanceOf(TemplateInstanceConflict)
  })

  it('rejects the same idempotency key with different media choices instead of silently reusing', async () => {
    state.uploads.push({
      id: 'owned_photo_b', workspaceId: 'ws_a', status: 'COMPLETE', mime: 'image/png',
      durationMs: null, width: 1200, height: 1600,
    })
    await publishTemplateProject('ws_a', 'request_key_123', family, design, choices)
    await expect(publishTemplateProject(
      'ws_a', 'request_key_123', family, design,
      { media: { first: { ...photo, id: 'owned_photo_b' } } },
    )).rejects.toBeInstanceOf(TemplateInstanceConflict)
  })

  it('pins revisions across idempotent retries and rejects a different definition', async () => {
    await publishTemplateProject('ws_a', 'request_key_123', family, design, choices)
    await expect(publishTemplateProject(
      'ws_a', 'request_key_123',
      { ...family, revision: 2 },
      { ...design, familyRevision: 2 },
      choices,
    )).rejects.toBeInstanceOf(TemplateInstanceConflict)
  })

  it('cancels pending carrier work idempotently without deleting the timeline', async () => {
    const published = await publishTemplateProject('ws_a', 'request_key_123', family, design, choices)
    const edits = structuredClone(state.clips[0]!.edits)
    await cancelTemplateProject('ws_a', published.projectId)
    await cancelTemplateProject('ws_a', published.projectId)
    expect(state.projects[0]!.status).toBe('CANCELED')
    expect(state.jobs[0]!.status).toBe('FAILED')
    expect(state.clips[0]!.edits).toEqual(edits)
  })
})

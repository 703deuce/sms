import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rows, uploads, db } = vi.hoisted(() => {
  const rows: Record<string, any>[] = []
  const uploads: Record<string, any>[] = []
  const db = {
    clipVideoTemplateInstance: {
      findUnique: vi.fn(async ({ where }: any) => rows.find(r => r.workspaceId === where.workspaceId_idempotencyKey.workspaceId &&
        r.idempotencyKey === where.workspaceId_idempotencyKey.idempotencyKey) ?? null),
      create: vi.fn(async ({ data }: any) => {
        const r = { ...data, authoringVersion: 0 }
        rows.push(r)
        return r
      }),
      findFirst: vi.fn(async ({ where }: any) => rows.find(r => r.id === where.id && r.workspaceId === where.workspaceId &&
        (!where.status || where.status === r.status)) ?? null),
      findFirstOrThrow: vi.fn(async ({ where }: any) => {
        const r = rows.find(x => x.id === where.id && x.workspaceId === where.workspaceId)
        if (!r) throw new Error('Not found')
        return r
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const r = rows.find(x => x.id === where.id && x.workspaceId === where.workspaceId &&
          (!where.status || where.status === x.status) &&
          (where.authoringVersion === undefined || where.authoringVersion === x.authoringVersion))
        if (!r) return { count: 0 }
        if (data.authoringState) r.authoringState = data.authoringState
        if (data.authoringVersion?.increment) r.authoringVersion += data.authoringVersion.increment
        if (data.status) r.status = data.status
        return { count: 1 }
      }),
    },
    clipUpload: {
      findMany: vi.fn(async ({ where }: any) => uploads.filter(x => x.workspaceId === where.workspaceId &&
        x.status === 'COMPLETE' && where.id.in.includes(x.id))),
    },
  }
  return { rows, uploads, db }
})
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/db', () => ({ getPrisma: () => db }))
vi.mock('@/lib/supabase/id', () => ({ createId: () => 'vti_fixed' }))

import {
  createTemplateAuthoringDraft,
  saveTemplateAuthoringDraft,
  cancelTemplateAuthoringDraft,
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
}
beforeEach(() => {
  rows.splice(0)
  uploads.splice(0)
  vi.clearAllMocks()
})
describe('B3 isolated template instance persistence', () => {
  it('creates once, returning original pinned snapshot on idempotent retry', async () => {
    const first = await createTemplateAuthoringDraft('ws_a', 'request_key_123', family, design)
    const retry = await createTemplateAuthoringDraft('ws_a', 'request_key_123', family, design)
    expect(retry.id).toBe(first.id)
    expect(db.clipVideoTemplateInstance.create).toHaveBeenCalledTimes(1)
    expect((first.snapshot as unknown as { family: { revision: number } }).family.revision).toBe(1)
    await expect(createTemplateAuthoringDraft('ws_a', 'request_key_123',
      { ...family, revision: 2 }, { ...design, familyRevision: 2 })).rejects.toThrow(/revision conflict/)
  })
  it('rejects foreign uploads without revealing existence or writing a draft', async () => {
    await createTemplateAuthoringDraft('ws_a', 'request_key_123', family, design)
    await expect(saveTemplateAuthoringDraft('ws_a', 'vti_fixed', 0,
      { instanceId: 'vti_fixed', media: { first: photo } } as never)).rejects.toThrow(/unavailable/)
    expect(db.clipVideoTemplateInstance.updateMany).not.toHaveBeenCalled()
  })
  it('saves with CAS and blocks stale versions while leaving clip edits untouched', async () => {
    await createTemplateAuthoringDraft('ws_a', 'request_key_123', family, design)
    uploads.push({ workspaceId: 'ws_a', id: 'owned_photo', status: 'COMPLETE', mime: 'image/png' })
    const chosen = { instanceId: 'vti_fixed', media: { first: photo } } as never
    const saved = await saveTemplateAuthoringDraft('ws_a', 'vti_fixed', 0, chosen)
    expect(saved.authoringVersion).toBe(1)
    expect((saved.authoringState as unknown as { media: { first: { id: string } } }).media.first.id).toBe('owned_photo')
    await expect(saveTemplateAuthoringDraft('ws_a', 'vti_fixed', 0, chosen)).rejects.toThrow(/revision conflict/)
    await expect(saveTemplateAuthoringDraft('ws_foreign', 'vti_fixed', 0, chosen)).rejects.toThrow('Not found')
  })
  it('makes cancel idempotent and prevents edits after cancel', async () => {
    await createTemplateAuthoringDraft('ws_a', 'request_key_123', family, design)
    await cancelTemplateAuthoringDraft('ws_a', 'vti_fixed')
    await cancelTemplateAuthoringDraft('ws_a', 'vti_fixed')
    expect(rows[0].status).toBe('CANCELED')
    await expect(saveTemplateAuthoringDraft('ws_a', 'vti_fixed', 0,
      { instanceId: 'vti_fixed', media: {} })).rejects.toThrow('Not found')
  })
})

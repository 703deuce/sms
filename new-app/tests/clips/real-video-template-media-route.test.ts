import { beforeEach, describe, expect, it, vi } from 'vitest'

const { uploads, findMany, count, signed } = vi.hoisted(() => {
  const uploads: Record<string, any>[] = []
  const matching = ({ where }: any) => uploads.filter(row =>
    row.workspaceId === where.workspaceId && row.status === where.status &&
    (!where.id || where.id.in.includes(row.id)) &&
    (!where.mime || row.mime.startsWith(where.mime.startsWith)) &&
    (!where.OR || where.OR.some((term: any) => row.mime.startsWith(term.mime.startsWith))) &&
    (!where.filename || row.filename.includes(where.filename.contains)))
  return {
    uploads,
    count: vi.fn(async (args: any) => matching(args).length),
    findMany: vi.fn(async (args: any) => matching(args).slice(args.skip, args.skip + args.take)),
    signed: vi.fn(async (key: string) => 'https://signed.example/' + key),
  }
})
vi.mock('@/lib/server/db', () => ({ getPrisma: () => ({ clipUpload: { findMany, count } }) }))
vi.mock('@/lib/server/workspace', () => ({ resolveWorkspaceId: async () => 'workspace_one' }))
vi.mock('@/lib/storage', () => ({ getClipStorage: () => ({ createSignedDownloadUrl: signed }) }))

import { GET } from '@/app/api/clips/video-templates/media/route'
const call = (params: string) => GET(new Request('https://example.test/api/clips/video-templates/media?' + params))

beforeEach(() => {
  uploads.length = 0
  vi.clearAllMocks()
  for (let i = 0; i < 90; i++) uploads.push({
    id: 'own_' + i, workspaceId: 'workspace_one', status: 'COMPLETE',
    filename: 'Upload ' + i, mime: 'video/mp4', durationMs: 2000,
    storageDriver: 's3', key: 'key_' + i, bytes: 100, width: 1080, height: 1920,
  })
  uploads.push({
    id: 'foreign', workspaceId: 'workspace_other', status: 'COMPLETE',
    filename: 'Other workspace', mime: 'video/mp4', durationMs: 2000,
    storageDriver: 's3', key: 'foreign_key', bytes: 100,
  })
})

describe('Batch 4 selected-media resume', () => {
  it('looks up assets beyond page one with original duration and workspace authorization', async () => {
    const response = await call('ids=own_89,own_79,foreign,own_89')
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.items.map((item: any) => item.asset.id)).toEqual(['own_79', 'own_89'])
    expect(body.data.items.every((item: any) => item.asset.durationFrames === 60)).toBe(true)
    expect(body.data.items.every((item: any) => item.available)).toBe(true)
    expect(body.data.total).toBe(2)
    expect(body.data.page).toBe(1)
    expect(body.data.pages).toBe(1)
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      workspaceId: 'workspace_one', status: 'COMPLETE',
      id: { in: ['own_89', 'own_79', 'foreign'] },
    })
  })
  it('keeps bounded ordinary pagination intact', async () => {
    const response = await call('page=2&kind=video')
    const body = await response.json()
    expect(body.data.total).toBe(90)
    expect(body.data.items).toHaveLength(30)
    expect(body.data.pages).toBe(2)
    expect(body.data.page).toBe(2)
  })
  it('rejects empty, malformed or excessive direct ID lists', async () => {
    expect((await call('ids=')).status).toBe(400)
    expect((await call('ids=own_1,%2Fstorage%2Fsecret')).status).toBe(400)
    expect((await call('ids=' + Array.from({length:61}, (_,i)=>'x'+i).join(','))).status).toBe(400)
    expect(findMany).not.toHaveBeenCalled()
  })
})

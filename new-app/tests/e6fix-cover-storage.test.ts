import { beforeEach, describe, expect, it, vi } from 'vitest'

// E6fix: covers were uploaded to Supabase by the Kie callback but signed against B2 → NoSuchKey.
const b2Objects = new Set<string>()
const sbObjects = new Set<string>()
const heads = { b2: 0, sb: 0 }
const mkDriver = (name: 's3' | 'supabase', objs: Set<string>, host: string) => ({
  name,
  async getObjectSizeBytes(k: string) {
    heads[name === 's3' ? 'b2' : 'sb']++
    return objs.has(k) ? 1 : null
  },
  async createSignedDownloadUrl(k: string) {
    return `https://${host}/${k}?sig`
  },
  async putBytes(k: string) {
    objs.add(k)
  },
})
vi.mock('@/lib/storage/s3-driver', () => ({ createS3StorageDriver: () => mkDriver('s3', b2Objects, 'b2') }))
vi.mock('@/lib/storage/supabase-driver', () => ({
  createSupabaseStorageDriver: () => mkDriver('supabase', sbObjects, 'sb'),
  getSupabaseStorageConfig: () => ({ url: 'x', key: 'x', bucket: 'clips' }),
}))

import { __resetReadableDriverMemo, createReadableSignedUrl, getClipStorage } from '@/lib/storage/resolve'

describe('E6fix cover storage', () => {
  beforeEach(() => {
    process.env.STORAGE_DRIVER = 's3'
    b2Objects.clear()
    sbObjects.clear()
    heads.b2 = heads.sb = 0
    __resetReadableDriverMemo()
  })

  it('legacy cover that only exists in Supabase is signed against Supabase (was B2 → 404)', async () => {
    sbObjects.add('ws/ws_1/clips/c/thumbnails/gen_1.png')
    expect(await createReadableSignedUrl('ws/ws_1/clips/c/thumbnails/gen_1.png', 3600)).toBe(
      'https://sb/ws/ws_1/clips/c/thumbnails/gen_1.png?sig',
    )
  })

  it('new cover written through getClipStorage() lands on B2 and is signed there', async () => {
    await getClipStorage().putBytes('k.png', Buffer.from('x'), 'image/png')
    expect(b2Objects.has('k.png')).toBe(true)
    expect(await createReadableSignedUrl('k.png', 3600)).toBe('https://b2/k.png?sig')
  })

  it('memoises the driver per key (no HEAD per poll), but not a miss', async () => {
    sbObjects.add('a.png')
    await createReadableSignedUrl('a.png', 3600)
    await createReadableSignedUrl('a.png', 3600)
    expect(heads).toEqual({ b2: 1, sb: 1 })
    expect(await createReadableSignedUrl('missing.png', 60)).toBe('https://b2/missing.png?sig')
    b2Objects.add('missing.png')
    await createReadableSignedUrl('missing.png', 60)
    expect(heads.b2).toBe(3)
  })

  it('kie callback no longer uploads straight to Supabase', async () => {
    const fs = await import('node:fs')
    const src = fs.readFileSync(new URL('../app/api/clips/kie/callback/route.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/supabase\.storage|getSupabaseStorageConfig|@supabase\/supabase-js/)
    expect(src).toMatch(/storage\.putBytes\(storageKey/)
  })
})

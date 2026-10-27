import { describe, expect, it } from 'vitest'
import { brandTemplateSettingsSchema, defaultBrandSettings } from '@/lib/clips/brand'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'

describe('brand template JSON', () => {
  it('merges partial settings and serializes for Prisma', () => {
    const base = defaultBrandSettings()
    const merged = brandTemplateSettingsSchema.parse({
      ...base,
      primaryColor: '#112233',
    })
    const json = toPrismaJson(merged)
    expect(json).toMatchObject({ primaryColor: '#112233' })
    expect(() => brandTemplateSettingsSchema.parse(json)).not.toThrow()
  })
})

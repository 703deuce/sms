import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GeminiContentPart } from '@/lib/server/ai/gemini-flash-lite'

const storage = vi.hoisted(() => ({
  primaryBytes: Buffer.from('product-image-bytes'),
  primaryFails: false,
  legacyBytes: Buffer.from('legacy-bytes'),
  getObjectBytes: vi.fn(async (key: string) => {
    if (key === 'ws/product.jpg') {
      if (storage.primaryFails) throw new Error('NoSuchKey on primary')
      return storage.primaryBytes
    }
    throw new Error(`unexpected key ${key}`)
  }),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({
    aiStudioAsset: {
      findFirst: async () => ({
        id: 'stast_test',
        storageKey: 'ws/product.jpg',
        storageDriver: 's3',
        contentType: 'image/jpeg',
      }),
    },
  }),
}))
vi.mock('@/lib/storage', () => ({
  getClipStorageForObjectKey: vi.fn(async () => ({
    name: 's3',
    getObjectBytes: storage.getObjectBytes,
  })),
  getReadableClipStorage: vi.fn(async () => ({
    name: 'supabase',
    getObjectBytes: async () => storage.legacyBytes,
  })),
}))
vi.mock('@/lib/server/ai/gemini-flash-lite', () => ({
  discoverVisionFlashLiteModel: vi.fn(async () => 'gemini-flash-lite-test'),
  geminiGenerateJson: vi.fn(async () => ({
    text: JSON.stringify([
      { prompt: 'p1', style: 'signature-premium-product', layoutNotes: 'n1' },
      { prompt: 'p2', style: 'human-lifestyle', layoutNotes: 'n2' },
      { prompt: 'p3', style: 'illustrated-graphic', layoutNotes: 'n3' },
      { prompt: 'p4', style: 'clean-white-packshot', layoutNotes: 'n4' },
      { prompt: 'p5', style: 'typography-dominant', layoutNotes: 'n5' },
    ]),
    promptTokens: 1,
    outputTokens: 1,
  })),
}))

import { safeAdStudioLogMessage } from '@/lib/server/ad-studio/log-safe'
import {
  bufferToGeminiPart,
  estimateGeminiInlineBytes,
  GEMINI_INLINE_BUDGET_BYTES,
  readStorageImageBytes,
  tightenGeminiVisionParts,
} from '@/lib/server/ad-studio/gemini-inline-image'
import {
  KIMI_PHOTO_ADS_SYSTEM_PROMPT_FILE,
  LEGACY_GEMINI_PHOTO_ADS_SYSTEM_PROMPT_UNUSED,
  LEGACY_KIMI_PHOTO_ADS_SYSTEM_PROMPT,
} from '@/lib/server/ad-studio/legacy-photo-ad-prompts'
import { generatePhotoAdConcepts } from '@/lib/server/ad-studio/photo-ads'
import { geminiGenerateJson } from '@/lib/server/ai/gemini-flash-lite'

describe('Ad Studio photo-ad inline images', () => {
  const verbatimKimiSystemPrompt = readFileSync(KIMI_PHOTO_ADS_SYSTEM_PROMPT_FILE, 'utf8')

  beforeEach(() => {
    storage.primaryFails = false
    storage.getObjectBytes.mockClear()
    vi.mocked(geminiGenerateJson).mockClear()
  })

  it('uses verbatim Kimi production system prompt (not alternate Gemini prompt) for concept planning', () => {
    expect(LEGACY_KIMI_PHOTO_ADS_SYSTEM_PROMPT).toBe(verbatimKimiSystemPrompt)
    expect(verbatimKimiSystemPrompt).toContain('TYPOGRAPHY MASTER SYSTEM')
    expect(LEGACY_GEMINI_PHOTO_ADS_SYSTEM_PROMPT_UNUSED).not.toContain('TYPOGRAPHY MASTER SYSTEM')
  })

  it('passes verbatim Kimi system prompt as Gemini systemInstruction on concept step', async () => {
    await generatePhotoAdConcepts('ws_test', {
      name: 'Sneaker',
      sellingPoints: ['Front zip'],
      headline: 'ZIP IN',
      subHeadline: 'Mid-top',
      cta: 'SHOP',
      aspect: '9:16',
      durationSec: 15,
      imageAssetIds: ['stast_test'],
    })
    const calls = vi.mocked(geminiGenerateJson).mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const systemInstruction = calls[0]![0].systemInstruction
    expect(systemInstruction).toBe(verbatimKimiSystemPrompt)
    expect(systemInstruction).toContain('TYPOGRAPHY MASTER SYSTEM')
  })

  it('redacts signed URLs and secrets from planning log messages', () => {
    const out = safeAdStudioLogMessage(
      new Error('fetch failed https://b2.example/ws/x.jpg?X-Amz-Signature=abc&token=secret'),
    )
    expect(out.message).not.toMatch(/https?:\/\//)
    expect(out.message).not.toMatch(/X-Amz-Signature/)
    expect(out.message).toContain('[url]')
  })

  it('reads product bytes via storage driver getObjectBytes (not presigned HTTP fetch)', async () => {
    const bytes = await readStorageImageBytes('ws/product.jpg', 's3')
    expect(bytes.equals(storage.primaryBytes)).toBe(true)
    expect(storage.getObjectBytes).toHaveBeenCalledWith('ws/product.jpg')
  })

  it('falls back to readable storage when hinted driver misses the object', async () => {
    storage.primaryFails = true
    const bytes = await readStorageImageBytes('ws/product.jpg', 's3')
    expect(bytes.equals(storage.legacyBytes)).toBe(true)
  })

  it('loads style refs from the module directory and completes concept planning without fetch', async () => {
    const styleDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../lib/server/ad-studio/style-refs')
    const { promises: fs } = await import('node:fs')
    const hasRefs = await fs.access(path.join(styleDir, 'kka.png')).then(() => true).catch(() => false)
    expect(hasRefs).toBe(true)

    const out = await generatePhotoAdConcepts('ws_test', {
      name: 'Sneaker',
      sellingPoints: ['Front zip'],
      headline: 'ZIP IN',
      subHeadline: 'Mid-top',
      cta: 'SHOP',
      aspect: '9:16',
      durationSec: 15,
      imageAssetIds: ['stast_test'],
    })
    expect(out.concepts).toHaveLength(5)
    expect(out.styleReferenceCount).toBeGreaterThan(0)
    expect(storage.getObjectBytes).toHaveBeenCalled()
  })

  it('downscales oversized inline payload when over Gemini budget', async () => {
    const styleDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../lib/server/ad-studio/style-refs')
    const { promises: fs } = await import('node:fs')
    const refPng = await fs.readFile(path.join(styleDir, 'assss.png'))
    const parts: GeminiContentPart[] = Array.from({ length: 8 }, () => bufferToGeminiPart(refPng, 'image/png'))
    parts.push({ text: 'brief' })
    expect(estimateGeminiInlineBytes(parts)).toBeGreaterThan(GEMINI_INLINE_BUDGET_BYTES)
    const tightened = await tightenGeminiVisionParts(parts)
    expect(estimateGeminiInlineBytes(tightened)).toBeLessThan(estimateGeminiInlineBytes(parts))
    expect(estimateGeminiInlineBytes(tightened)).toBeLessThanOrEqual(GEMINI_INLINE_BUDGET_BYTES)
    expect(tightened.filter((p) => 'inlineData' in p).length).toBeLessThan(parts.filter((p) => 'inlineData' in p).length)
  })
})

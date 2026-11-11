import 'server-only'
import { getClipStorageForObjectKey, getReadableClipStorage } from '@/lib/storage'
import type { GeminiContentPart } from '@/lib/server/ai/gemini-flash-lite'

/** Gemini inline payload budget — downscale large refs before vision JSON call (files on disk unchanged). */
export const GEMINI_INLINE_BUDGET_BYTES = 18 * 1024 * 1024
const DOWNSCALE_MAX_EDGE = 1024

export function estimateGeminiInlineBytes(parts: GeminiContentPart[]): number {
  let total = 0
  for (const part of parts) {
    if ('text' in part) total += Buffer.byteLength(part.text, 'utf8')
    else if (part.inlineData?.data) total += Buffer.byteLength(part.inlineData.data, 'base64')
  }
  return total
}

export async function readStorageImageBytes(
  storageKey: string,
  storageDriver: string | null | undefined,
): Promise<Buffer> {
  const hinted = await getClipStorageForObjectKey(storageKey, storageDriver ?? null)
  try {
    return await hinted.getObjectBytes(storageKey)
  } catch (primaryErr) {
    const readable = await getReadableClipStorage(storageKey)
    if (readable.name === hinted.name) throw primaryErr
    return readable.getObjectBytes(storageKey)
  }
}

export function bufferToGeminiPart(bytes: Buffer, mimeType: string): GeminiContentPart {
  return { inlineData: { mimeType, data: bytes.toString('base64') } }
}

async function downscaleImageJpeg(bytes: Buffer): Promise<Buffer> {
  try {
    const mod = await import('sharp')
    const sharp = mod.default
    return await sharp(bytes)
      .rotate()
      .resize({ width: DOWNSCALE_MAX_EDGE, height: DOWNSCALE_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()
  } catch {
    return bytes
  }
}

function dropTrailingStyleRefs(parts: GeminiContentPart[]): GeminiContentPart[] {
  const textIdx = parts.findLastIndex((part) => 'text' in part)
  const headEnd = textIdx > 0 ? Math.min(2, textIdx) : Math.min(2, parts.length)
  const head = parts.slice(0, headEnd)
  const text = textIdx >= 0 ? parts.slice(textIdx) : []
  const images = textIdx > 0 ? parts.slice(headEnd, textIdx) : parts.slice(headEnd)
  for (let keep = images.length; keep >= 0; keep--) {
    const candidate = [...head, ...images.slice(0, keep), ...text]
    if (estimateGeminiInlineBytes(candidate) <= GEMINI_INLINE_BUDGET_BYTES) return candidate
  }
  return [...head, ...text]
}

/** Downscale inline image parts in memory when the combined payload is near Gemini limits. */
export async function tightenGeminiVisionParts(parts: GeminiContentPart[]): Promise<GeminiContentPart[]> {
  if (estimateGeminiInlineBytes(parts) <= GEMINI_INLINE_BUDGET_BYTES) return parts
  console.info('[ad-studio:r5] gemini_payload_downscale_begin', { partCount: parts.length })
  const out: GeminiContentPart[] = []
  for (const part of parts) {
    if ('text' in part) {
      out.push(part)
      continue
    }
    const raw = Buffer.from(part.inlineData.data, 'base64')
    const scaled = await downscaleImageJpeg(raw)
    const mime = scaled === raw ? part.inlineData.mimeType : 'image/jpeg'
    out.push(bufferToGeminiPart(scaled, mime))
  }
  let tightened = out
  if (estimateGeminiInlineBytes(tightened) > GEMINI_INLINE_BUDGET_BYTES) {
    tightened = dropTrailingStyleRefs(tightened)
    console.warn('[ad-studio:r5] gemini_payload_trimmed_style_refs', {
      afterBytes: estimateGeminiInlineBytes(tightened),
    })
  }
  console.info('[ad-studio:r5] gemini_payload_downscale_complete', {
    beforeBytes: estimateGeminiInlineBytes(parts),
    afterBytes: estimateGeminiInlineBytes(tightened),
  })
  return tightened
}

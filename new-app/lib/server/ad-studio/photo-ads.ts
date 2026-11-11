import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { discoverVisionFlashLiteModel, geminiGenerateJson, type GeminiContentPart } from '@/lib/server/ai/gemini-flash-lite'
import { getPrisma } from '@/lib/server/db'
import { getClipStorageForObjectKey } from '@/lib/storage'
import type { AdPhotoConcept, AdPhotoQc, AdProductInput } from '@/lib/ad-studio/types'
import {
  PHOTO_ADS_PROMPT_COUNT,
  LEGACY_PHOTO_ADS_SYSTEM_PROMPT,
  LEGACY_PHOTO_ADS_USER_TEMPLATE,
  LEGACY_PHOTO_AD_QC_SYSTEM_PROMPT,
} from '@/lib/server/ad-studio/legacy-photo-ad-prompts'

const PREFIX = 'Think step-by-step: 1) spatial physics 2) text rendering 3) lighting coherence before generating.'
/** Legacy Kimi writer: product (+ logo) first, then at most six style reference images. */
const MAX_STYLE_REFERENCE_IMAGES = 6
const STYLE_NAMES = ['kka.png','assss.png','r1.png','r2.png','H1.png','h2.png','h3.png','yt1.png','yt2.png','yt3.png'] as const
const STYLE_TAGS = [
  'signature-premium-product','human-lifestyle','illustrated-graphic','clean-white-packshot',
  'typography-dominant','social-proof-trust','feature-callout-infographic','problem-solution',
  'ui-saas-mockup','discount-promotional','large-product-environment','multi-product-collection',
] as const

function token(name: string): string { return '$' + '{' + name + '}' }
function productInfo(input: AdProductInput): string {
  return [input.name, ...input.sellingPoints, input.brandNotes].filter(Boolean).join('\n')
}
function outputSpec(aspect: AdProductInput['aspect']): string {
  if (aspect === '9:16') return '9:16 vertical (stories/mobile), shortest edge >= 2048px.'
  if (aspect === '16:9') return '16:9 horizontal (feed/banner), shortest edge >= 2048px.'
  if (aspect === '3:4') return '3:4 portrait, shortest edge >= 2048px.'
  return '1:1 square (social feed), shortest edge >= 2048px.'
}

async function fetchInline(url: string, mimeHint?: string): Promise<GeminiContentPart> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error('Could not read image for Gemini vision')
  return { inlineData: {
    mimeType: mimeHint || res.headers.get('content-type') || 'image/png',
    data: Buffer.from(await res.arrayBuffer()).toString('base64'),
  } }
}

async function inlineAsset(workspaceId: string, assetId: string): Promise<GeminiContentPart> {
  const asset = await getPrisma().aiStudioAsset.findFirst({ where: { id: assetId, workspaceId, kind: 'image' } })
  if (!asset) throw new Error('Ad Studio image asset was not found')
  const storage = await getClipStorageForObjectKey(asset.storageKey, asset.storageDriver)
  const signed = await storage.createSignedDownloadUrl(asset.storageKey, 300)
  return fetchInline(signed, asset.contentType)
}

async function styleParts(): Promise<GeminiContentPart[]> {
  const dir = path.join(process.cwd(), 'lib/server/ad-studio/style-refs')
  const out: GeminiContentPart[] = []
  for (const name of STYLE_NAMES) {
    if (out.length >= MAX_STYLE_REFERENCE_IMAGES) break
    try {
      const bytes = await fs.readFile(path.join(dir, name))
      out.push({ inlineData: { mimeType: 'image/png', data: bytes.toString('base64') } })
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('[ad-studio:r5] style_ref_read_failed', { name, type: err instanceof Error ? err.name : typeof err })
      }
    }
  }
  console.info('[ad-studio:r5] style_refs_loaded', { count: out.length })
  return out
}

function renderLegacyUserMessage(input: AdProductInput, styleRefCount: number): string {
  let text = LEGACY_PHOTO_ADS_USER_TEMPLATE
  const replace = (name: string, value: string) => { text = text.split(token(name)).join(value) }
  replace('count', String(PHOTO_ADS_PROMPT_COUNT))
  replace('req.productInfo', productInfo(input))
  replace('req.headline', input.headline || '')
  replace('req.subHeadline || "none"', input.subHeadline || 'none')
  replace('ctaInstructionText', 'CTA (include this EXACT text in every prompt on a button):\n' + (input.cta || ''))
  replace('req.brandColors.primary', input.brandColors?.primary || '')
  replace('req.brandColors.secondary ?? "none"', input.brandColors?.secondary || 'none')
  replace('req.platform ?? "generic"', 'generic')
  replace('outputSpecForSize(req.size)', outputSpec(input.aspect))
  replace('productImageRule', 'Product image is attached and must be treated as the product truth. Every prompt MUST start with: "Create an ad using the reference image provided (which shows the product); place that product as the hero. "')
  replace('logoRule', input.logoAssetId
    ? 'Logo image is attached. Include explicit instruction to use the provided logo in layout.'
    : 'No logo image attached; do not force logo usage.')
  replace('KIMI_PHOTO_STYLE_TAGS.join(", ")', STYLE_TAGS.join(', '))
  replace('wearableMinCount', '3')
  replace('textFieldInstruction', '11. Keep text instructions clean: headline/sub-headline/CTA only, without camera metadata.')
  text = text.split('\n').map((line) => {
    if (line.includes('referenceDataUrls.length > 0 ?')) {
      return styleRefCount > 0
        ? 'Style reference images attached (' + styleRefCount + ' image(s)). Study them carefully and let them drive layout language, composition choices, stylistic direction, and category-adjacent execution patterns. Use user copy + product truth for message and fidelity, and use these references as the primary creative direction signal.'
        : 'No style reference images attached.'
    }
    if (line.includes('noveltyMemoryText ?')) return ''
    return line
  }).join('\n')
  if (/\$\{[^}]+\}/.test(text)) throw new Error('Legacy photo-ad user template has unresolved fields')
  return text
}

const conceptSchema: Record<string, unknown> = {
  type: 'ARRAY', minItems: 5, maxItems: 5,
  items: { type: 'OBJECT', required: ['prompt','style','layoutNotes'], properties: {
    prompt: { type: 'STRING' }, style: { type: 'STRING' }, layoutNotes: { type: 'STRING' },
  } },
}

async function geminiJson<T>(
  parts: GeminiContentPart[],
  responseSchema: Record<string, unknown>,
  systemInstruction: string,
): Promise<{ value: T; model: string }> {
  let last: unknown
  for (const model of ['gemini-3.1-pro-preview','gemini-3-flash-preview']) {
    try {
      console.info('[ad-studio:r5] gemini_attempt', { model })
      const out = await geminiGenerateJson({ model, parts, responseSchema, systemInstruction, timeoutMs: 120_000 })
      return { value: JSON.parse(out.text) as T, model }
    } catch (err) {
      last = err
      console.warn('[ad-studio:r5] gemini_attempt_failed', { model, type: err instanceof Error ? err.name : typeof err })
    }
  }
  const model = await discoverVisionFlashLiteModel()
  console.warn('[ad-studio:r5] gemini_flash_lite_fallback', { model, priorFailure: last instanceof Error ? last.name : typeof last })
  const out = await geminiGenerateJson({ model, parts, responseSchema, systemInstruction, timeoutMs: 120_000 })
  return { value: JSON.parse(out.text) as T, model }
}

export async function generatePhotoAdConcepts(workspaceId: string, input: AdProductInput): Promise<{
  concepts: AdPhotoConcept[]
  model: string
  styleReferenceCount: number
}> {
  if (!input.imageAssetIds[0]) throw new Error('Photo ads require a product image')
  console.info('[ad-studio:r5] concepts_begin', { aspect: input.aspect, hasLogo: Boolean(input.logoAssetId) })
  const product = await inlineAsset(workspaceId, input.imageAssetIds[0])
  const logo = input.logoAssetId ? await inlineAsset(workspaceId, input.logoAssetId) : null
  const styleRefs = await styleParts()
  const user = renderLegacyUserMessage(input, styleRefs.length)
  const systemInstruction = LEGACY_PHOTO_ADS_SYSTEM_PROMPT.split(token('PHOTO_ADS_PROMPT_COUNT')).join(String(PHOTO_ADS_PROMPT_COUNT))
  const parts: GeminiContentPart[] = [
    product,
    ...(logo ? [logo] : []),
    ...styleRefs.slice(0, MAX_STYLE_REFERENCE_IMAGES),
    { text: user },
  ]
  const { value, model } = await geminiJson<AdPhotoConcept[]>(parts, conceptSchema, systemInstruction)
  if (!Array.isArray(value) || value.length !== PHOTO_ADS_PROMPT_COUNT) throw new Error('Gemini did not return exactly five photo-ad concepts')
  const concepts = value.map((item, index) => {
    const prompt = typeof item.prompt === 'string' ? item.prompt.trim() : ''
    const style = typeof item.style === 'string' ? item.style.trim() : ''
    const layoutNotes = typeof item.layoutNotes === 'string' ? item.layoutNotes.trim() : ''
    if (!prompt || !style || !layoutNotes) throw new Error('Photo-ad concept ' + (index + 1) + ' is incomplete')
    return { prompt: prompt.startsWith(PREFIX) ? prompt : PREFIX + ' ' + prompt, style, layoutNotes }
  })
  if (new Set(concepts.map((item) => item.prompt)).size !== PHOTO_ADS_PROMPT_COUNT) throw new Error('Photo-ad concepts must be distinct')
  console.info('[ad-studio:r5] concepts_complete', { count: concepts.length, model, styleReferenceCount: styleRefs.length })
  return { concepts, model, styleReferenceCount: styleRefs.length }
}

function clampScore(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.min(10, Number(n.toFixed(2)))) : 0
}

export async function inlineStoredImage(storageKey: string, storageDriver: string | null): Promise<GeminiContentPart> {
  const storage = await getClipStorageForObjectKey(storageKey, storageDriver)
  const signed = await storage.createSignedDownloadUrl(storageKey, 300)
  return fetchInline(signed)
}

export async function reviewPhotoAdForQc(input: {
  imagePart: GeminiContentPart
  originalPrompt: string
  brief: AdProductInput
}): Promise<AdPhotoQc> {
  const user = [
    'Required exact text:',
    '- Headline: ' + (input.brief.headline || ''),
    '- Sub-headline: ' + (input.brief.subHeadline || ''),
    '- CTA: ' + (input.brief.cta || ''),
    '',
    'Product info:',
    productInfo(input.brief),
    '',
    'Original prompt:',
    input.originalPrompt,
    '',
    'Review this generated ad image against the required text and prompt intent.',
    'Return JSON only.',
  ].join('\n')
  const schema: Record<string, unknown> = {
    type:'OBJECT', required:['decision','reason','issues','scores','weightedScore'],
    properties:{
      decision:{type:'STRING'}, reason:{type:'STRING'}, issues:{type:'ARRAY',items:{type:'STRING'}},
      weightedScore:{type:'NUMBER'}, editPrompt:{type:'STRING'}, regeneratedPrompt:{type:'STRING'},
      scores:{type:'OBJECT',properties:{
        compositionalArchitecture:{type:'NUMBER'},lightingQuality:{type:'NUMBER'},productPresentation:{type:'NUMBER'},
        colorIntelligence:{type:'NUMBER'},typographyIntegration:{type:'NUMBER'},emotionalRegister:{type:'NUMBER'},
      }},
    },
  }
  const { value, model } = await geminiJson<Record<string, unknown>>(
    [input.imagePart, { text: user }],
    schema,
    LEGACY_PHOTO_AD_QC_SYSTEM_PROMPT,
  )
  const scores = value.scores && typeof value.scores === 'object' ? value.scores as Record<string, unknown> : {}
  const weightedFromModel = clampScore(value.weightedScore)
  const weightedScore = weightedFromModel || Number((
    clampScore(scores.compositionalArchitecture) * .25 +
    clampScore(scores.lightingQuality) * .25 +
    clampScore(scores.productPresentation) * .2 +
    clampScore(scores.colorIntelligence) * .15 +
    clampScore(scores.typographyIntegration) * .1 +
    clampScore(scores.emotionalRegister) * .05
  ).toFixed(2))
  const raw = String(value.decision || 'pass').toLowerCase()
  const baseDecision: AdPhotoQc['decision'] = raw === 'edit' || raw === 'regenerate' ? raw : 'pass'
  const editPrompt = typeof value.editPrompt === 'string' && value.editPrompt.trim() ? value.editPrompt.trim() : undefined
  let decision: AdPhotoQc['decision']
  if (weightedScore < 8.5) decision = 'regenerate'
  else if (weightedScore <= 9.2) decision = baseDecision === 'edit' && editPrompt ? 'edit' : 'regenerate'
  else decision = baseDecision
  const issues = Array.isArray(value.issues)
    ? value.issues.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim()).slice(0, 10)
    : []
  const qc: AdPhotoQc = {
    decision,
    reason: typeof value.reason === 'string' && value.reason.trim() ? value.reason.trim() : 'No reason provided',
    issues,
    weightedScore,
    reviewerModel: model,
    ...(editPrompt ? { editPrompt } : {}),
    ...(typeof value.regeneratedPrompt === 'string' && value.regeneratedPrompt.trim()
      ? { regeneratedPrompt: value.regeneratedPrompt.trim() }
      : {}),
  }
  console.info('[ad-studio:r5] still_qc_complete', { decision, weightedScore, reviewerModel: model })
  return qc
}

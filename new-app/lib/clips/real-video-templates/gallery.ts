import type { TemplateDesignV1, TemplateFamilyV1 } from './sequence-contract'
import { validateTemplateDesign, validateTemplateFamily } from './sequence-contract'

/**
 * First-party release manifest. Preview releases are usable before certification;
 * Certified releases additionally require reviewed, render-tested demo media.
 * Do not generate release records from a family × treatment Cartesian product.
 */
export type VideoTemplateRelease = {
  id: string
  category: string
  title: string
  description: string
  /** Certified releases use real reviewed demo media; Preview releases may use authored animated cards instead. */
  demoPath?: string
  demoPosterPath?: string
  /** Lightweight real-media card preview: one horizontal row of rendered frames. */
  previewMedia?: {
    spritePath: string
    frames: number
    columns: number
    sha256: string
    /** Sharp still for the idle card; hover cycles `framePosterPaths` when set. */
    posterPath?: string
    framePosterPaths?: readonly string[]
    /** Intrinsic width of frame posters (for srcset), e.g. 1080 for 2x 9:16 cards. */
    posterWidth?: number
  }
  family: TemplateFamilyV1
  design: TemplateDesignV1
  rights: string
  requiredCapabilities: string[]
  authoredDimensions: string[]
  reviewed: boolean
  previewRenderVerified: boolean
  certificationStatus?: 'preview' | 'certified'
  musicRequired?: boolean
  defaultMusic?: {
    id: string
    generator: 'batch9a-pulse-v1' | 'batch9a-groove-v2'
    sha256: string
    durationFrames: number
    bpm: number
    beatEveryFrames: number
    author: string
    license: string
    revision: string
  }
  previewStyle?: {
    foreground: string
    accent: string
    headingFont: string
    supportFont: string
    graphic: string
    enter: string
  }
}
export type VideoTemplateFilters = {
  query?: string
  category?: string
  aspect?: string
  minSlots?: number
  maxSlots?: number
  maxDurationSeconds?: number
}
export type VideoTemplatePage = {
  items: VideoTemplateRelease[]
  total: number
  page: number
  pages: number
}
const releaseId = /^[A-Za-z0-9_-]{1,80}$/
const localMediaPath = /^\/[^?#]+\.(mp4|webm|jpg|jpeg|png|webp)$/i
const allowedDimensions = new Set([
  'font-hierarchy', 'text-placement', 'animation-choreography',
  'graphic-composition', 'transition-treatment', 'source-motion',
])
export function validateVideoTemplateRelease(input: VideoTemplateRelease): VideoTemplateRelease {
  if (!releaseId.test(input.id)) throw new Error('Invalid video template release ID')
  const certificationStatus = input.certificationStatus ??
    (input.reviewed && input.previewRenderVerified ? 'certified' : 'preview')
  if (certificationStatus === 'certified' && (!input.reviewed || !input.previewRenderVerified))
    throw new Error('Certified templates require completed review and preview/render verification')
  if (certificationStatus === 'preview' && (input.reviewed || input.previewRenderVerified))
    throw new Error('Preview templates must not claim completed certification')
  if (certificationStatus === 'certified' &&
      (!input.demoPath || !input.demoPosterPath ||
       !localMediaPath.test(input.demoPath) || !/\.(mp4|webm)$/i.test(input.demoPath) ||
       !localMediaPath.test(input.demoPosterPath)))
    throw new Error('A certified local demo video and poster are required')
  if (certificationStatus === 'preview' &&
      ((input.demoPath && !localMediaPath.test(input.demoPath)) ||
       (input.demoPosterPath && !localMediaPath.test(input.demoPosterPath))))
    throw new Error('Preview media paths must remain local')
  if (input.previewMedia) {
    const media = input.previewMedia
    if (!localMediaPath.test(media.spritePath) || !/\.webp$/i.test(media.spritePath))
      throw new Error('Preview sprite must be a local WebP asset')
    if (!Number.isSafeInteger(media.frames) || media.frames < 2 || media.frames > 12 ||
        !Number.isSafeInteger(media.columns) || media.columns < media.frames || media.columns > 12 ||
        !/^[a-f0-9]{64}$/i.test(media.sha256))
      throw new Error('Invalid preview sprite definition')
    if (media.posterPath && (!localMediaPath.test(media.posterPath) || !/\.webp$/i.test(media.posterPath)))
      throw new Error('Preview poster must be a local WebP asset')
    if (media.framePosterPaths) {
      if (media.framePosterPaths.length < media.frames)
        throw new Error('framePosterPaths must cover every preview frame')
      for (const path of media.framePosterPaths) {
        if (!localMediaPath.test(path) || !/\.webp$/i.test(path))
          throw new Error('Preview frame posters must be local WebP assets')
      }
    }
  }
  if (!input.rights.trim()) throw new Error('Music and demo rights must be described')
  const family = validateTemplateFamily(input.family)
  const design = validateTemplateDesign(input.design, family)
  if (new Set(input.authoredDimensions.filter(x => allowedDimensions.has(x))).size < 3)
    throw new Error('A treatment needs at least three independently authored visible dimensions')
  if (!Array.isArray(input.requiredCapabilities) ||
      input.requiredCapabilities.some(x => !releaseId.test(x)))
    throw new Error('Unknown capability ID')
  // An unsupported requirement must never be advertised as a usable release.
  const supported = new Set(['clip_edits_v2', 'source_transforms', 'text_layers',
    'music_track', 'cross_source_transitions', 'frame_accurate_slots'])
  if (input.requiredCapabilities.some(x => !supported.has(x)))
    throw new Error('This first-party release requires an unimplemented capability')
  if (input.musicRequired && design.musicPolicy === 'none')
    throw new Error('Music-required template cannot forbid music')
  if (input.defaultMusic) {
    if (!/^[a-f0-9]{64}$/i.test(input.defaultMusic.sha256) ||
        input.defaultMusic.durationFrames < family.totalFrames ||
        input.defaultMusic.beatEveryFrames < 1 ||
        input.defaultMusic.bpm <= 0 || input.defaultMusic.bpm > 300)
      throw new Error('Invalid first-party default music definition')
  }
  return { ...input, certificationStatus, family, design }
}
export function validateVideoTemplateGallery(releases: readonly VideoTemplateRelease[]): VideoTemplateRelease[] {
  const ids = new Set<string>()
  const treatmentByFamily = new Map<string, Set<string>>()
  return releases.map(release => {
    const item = validateVideoTemplateRelease(release)
    if (ids.has(item.id)) throw new Error('Duplicate video template release')
    ids.add(item.id)
    const key = item.family.familyId
    const treatments = treatmentByFamily.get(key) ?? new Set<string>()
    if (treatments.has(item.design.designId)) throw new Error('Duplicate family treatment')
    treatments.add(item.design.designId)
    treatmentByFamily.set(key, treatments)
    return item
  })
}
export function filterVideoTemplates(
  releases: readonly VideoTemplateRelease[],
  filters: VideoTemplateFilters = {},
  page = 1,
  pageSize = 24,
): VideoTemplatePage {
  const q = (filters.query ?? '').trim().toLocaleLowerCase()
  const matching = releases.filter(item => {
    const family = item.family
    return (!q || [item.title, item.description, item.category, family.title, ...family.tags]
      .some(value => value.toLocaleLowerCase().includes(q))) &&
      (!filters.category || item.category === filters.category) &&
      (!filters.aspect || family.aspects.includes(filters.aspect as '9:16' | '16:9' | '1:1')) &&
      (filters.minSlots == null || family.slots.length >= filters.minSlots) &&
      (filters.maxSlots == null || family.slots.length <= filters.maxSlots) &&
      (filters.maxDurationSeconds == null || family.totalFrames / 30 <= filters.maxDurationSeconds)
  }).sort((a, b) => a.family.familyId.localeCompare(b.family.familyId) ||
    a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
  const size = Math.min(48, Math.max(1, Math.floor(pageSize) || 24))
  const pages = Math.max(1, Math.ceil(matching.length / size))
  const current = Math.min(pages, Math.max(1, Math.floor(page) || 1))
  return { items: matching.slice((current - 1) * size, current * size), total: matching.length, page: current, pages }
}

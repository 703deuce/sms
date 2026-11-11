import type { TemplateDesignV1, TemplateFamilyV1 } from './sequence-contract'
import { validateTemplateDesign, validateTemplateFamily } from './sequence-contract'

/**
 * This manifest contains ONLY reviewed and render-tested first-party releases.
 * Do not generate release records from a family × treatment Cartesian product.
 * Community and private templates are separate, workspace-scoped sources.
 */
export type VideoTemplateRelease = {
  id: string
  category: string
  title: string
  description: string
  demoPath: string
  demoPosterPath: string
  family: TemplateFamilyV1
  design: TemplateDesignV1
  rights: string
  requiredCapabilities: string[]
  authoredDimensions: string[]
  reviewed: true
  previewRenderVerified: true
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
  if (!input.reviewed || !input.previewRenderVerified)
    throw new Error('Unreviewed templates must not enter the released gallery')
  if (!localMediaPath.test(input.demoPath) || !/\.(mp4|webm)$/i.test(input.demoPath) ||
      !localMediaPath.test(input.demoPosterPath))
    throw new Error('A reviewed local demo video and poster are required')
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
  return { ...input, family, design }
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

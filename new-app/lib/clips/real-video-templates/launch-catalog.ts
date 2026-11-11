import {
  applyTemplateDesignTreatment,
  validateTemplateDesign,
  validateTemplateEditorialTiming,
  type TemplateDesignTreatment,
  type TemplateDesignV1,
  type TemplateFamilyV1,
} from '@/lib/clips/real-video-templates/sequence-contract'

export const FIRST_PARTY_LAUNCH_FAMILIES = 50
export const FIRST_PARTY_TREATMENTS_PER_FAMILY = 40
export const FIRST_PARTY_CORE_TREATMENTS = 25
export const FIRST_PARTY_AUTHORED_ALTERNATES = 15

export const VISIBLE_TEMPLATE_DIMENSIONS = [
  'font-hierarchy',
  'text-placement',
  'animation-choreography',
  'graphics',
  'transition-treatment',
  'source-safe-motion',
] as const
export type VisibleTemplateDimension = (typeof VISIBLE_TEMPLATE_DIMENSIONS)[number]
export type LaunchTreatmentKind = 'core' | 'authored-alternate'
export type LaunchTreatmentStatus = 'released' | 'draft' | 'failed' | 'incompatible'
export type LaunchTreatmentOrigin = 'first-party' | 'community'

export type FirstPartyLaunchTreatment = {
  design: TemplateDesignV1
  origin: LaunchTreatmentOrigin
  status: LaunchTreatmentStatus
  treatmentKind: LaunchTreatmentKind
}

export type FirstPartyLaunchCatalogSummary = {
  releasedFirstParty: number
  eligibleFamilies: number
  familyCounts: Record<string, {
    released: number
    core: number
    authoredAlternates: number
    coreStylePacks: number
  }>
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => JSON.stringify(k) + ':' + stable(v)).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

function eq(a: unknown, b: unknown): boolean {
  return stable(a ?? null) === stable(b ?? null)
}

function meaningfulTreatmentRecipe(family: TemplateFamilyV1, treatment: TemplateDesignTreatment | undefined) {
  if (!treatment) return { texts: [], graphics: [], slots: [] }
  const texts = (treatment.texts ?? []).flatMap((row) => {
    const base = family.texts.find((item) => item.id === row.id)
    if (!base) return []
    const delta: Record<string, unknown> = { id: row.id }
    if (row.font != null && row.font !== base.font) delta.font = row.font
    if (row.size != null && row.size !== base.size) delta.size = row.size
    if (row.x != null && row.x !== base.x) delta.x = row.x
    if (row.y != null && row.y !== base.y) delta.y = row.y
    if (row.animation != null && !eq(row.animation, base.animation)) delta.animation = row.animation
    if (row.motion != null && !eq(row.motion, base.motion)) delta.motion = row.motion
    return Object.keys(delta).length > 1 ? [delta] : []
  })
  const graphics = (treatment.graphics ?? []).flatMap((row) => {
    const base = family.graphics?.find((item) => item.id === row.id)
    if (!base) return []
    const delta: Record<string, unknown> = { id: row.id }
    if (row.type != null && row.type !== base.type) delta.type = row.type
    if (row.x != null && row.x !== base.x) delta.x = row.x
    if (row.y != null && row.y !== base.y) delta.y = row.y
    if (row.w != null && row.w !== base.w) delta.w = row.w
    if (row.h != null && row.h !== base.h) delta.h = row.h
    if (row.animation != null && !eq(row.animation, base.animation)) delta.animation = row.animation
    if (row.motion != null && !eq(row.motion, base.motion)) delta.motion = row.motion
    return Object.keys(delta).length > 1 ? [delta] : []
  })
  const slots = (treatment.slots ?? []).flatMap((row) => {
    const base = family.slots.find((item) => item.id === row.id)
    if (!base) return []
    const delta: Record<string, unknown> = { id: row.id }
    if (row.transition != null && !eq(row.transition, base.transition)) delta.transition = row.transition
    if (row.motion != null && !eq(row.motion, base.motion)) delta.motion = row.motion
    if (row.transform != null && !eq(row.transform, base.transform)) delta.transform = row.transform
    return Object.keys(delta).length > 1 ? [delta] : []
  })
  return { texts, graphics, slots }
}

export function designTreatmentDimensions(
  family: TemplateFamilyV1,
  treatment: TemplateDesignTreatment | undefined,
): VisibleTemplateDimension[] {
  const recipe = meaningfulTreatmentRecipe(family, treatment)
  const dims = new Set<VisibleTemplateDimension>()
  for (const row of recipe.texts) {
    if ('font' in row || 'size' in row) dims.add('font-hierarchy')
    if ('x' in row || 'y' in row) dims.add('text-placement')
    if ('animation' in row || 'motion' in row) dims.add('animation-choreography')
  }
  for (const row of recipe.graphics) {
    if ('type' in row || 'x' in row || 'y' in row || 'w' in row || 'h' in row) dims.add('graphics')
    if ('animation' in row || 'motion' in row) dims.add('animation-choreography')
  }
  for (const row of recipe.slots) {
    if ('transition' in row) dims.add('transition-treatment')
    if ('motion' in row || 'transform' in row) dims.add('source-safe-motion')
  }
  return [...dims].sort()
}

function treatmentSignature(family: TemplateFamilyV1, treatment: TemplateDesignTreatment | undefined): string {
  const recipe = meaningfulTreatmentRecipe(family, treatment)
  return stable({
    texts: [...recipe.texts].sort((a, b) => String(a.id).localeCompare(String(b.id))),
    graphics: [...recipe.graphics].sort((a, b) => String(a.id).localeCompare(String(b.id))),
    slots: [...recipe.slots].sort((a, b) => String(a.id).localeCompare(String(b.id))),
  })
}

/**
 * B3B launch gate. It validates real compiler-applied design treatments; it never counts names,
 * colors, community records, drafts/failures/incompatible rows or an unreviewed Cartesian product.
 */
export function assertFirstPartyLaunchCatalog(
  families: readonly TemplateFamilyV1[],
  rows: readonly FirstPartyLaunchTreatment[],
): FirstPartyLaunchCatalogSummary {
  const familyByRevision = new Map(families.map((f) => [`${f.familyId}@${f.revision}`, f]))
  const released = rows.filter((row) => row.origin === 'first-party' && row.status === 'released')
  const seenDesign = new Set<string>()
  const seenTreatmentByFamily = new Map<string, Set<string>>()
  const corePacksByFamily = new Map<string, Set<string>>()
  const normalizedRows: Array<{ row: FirstPartyLaunchTreatment; design: TemplateDesignV1; family: TemplateFamilyV1 }> = []

  for (const row of released) {
    const rawDesign = row.design
    const key = `${rawDesign.familyId}@${rawDesign.familyRevision}`
    const baseFamily = familyByRevision.get(key)
    if (!baseFamily) throw new Error(`launch catalog: unknown/incompatible family revision ${key}`)
    const design = validateTemplateDesign(rawDesign, baseFamily)
    const effectiveFamily = applyTemplateDesignTreatment(baseFamily, design)
    validateTemplateEditorialTiming(effectiveFamily)

    const designKey = `${key}:${design.designId}@${design.revision}`
    if (seenDesign.has(designKey)) throw new Error(`launch catalog: duplicate released design ${designKey}`)
    seenDesign.add(designKey)

    const dimensions = designTreatmentDimensions(baseFamily, design.treatment)
    if (dimensions.length < 3)
      throw new Error(`launch catalog: ${design.designId} must differ on at least three visible authored dimensions`)
    if (row.treatmentKind === 'authored-alternate' &&
        !dimensions.some((d) => d === 'font-hierarchy' || d === 'animation-choreography' || d === 'graphics'))
      throw new Error(`launch catalog: authored alternate ${design.designId} needs separately authored font/choreography/graphic work`)

    const signature = treatmentSignature(baseFamily, design.treatment)
    const signatures = seenTreatmentByFamily.get(key) ?? new Set<string>()
    if (signatures.has(signature))
      throw new Error(`launch catalog: duplicate treatment recipe in ${key}; design names/style packs do not create a new variant`)
    signatures.add(signature)
    seenTreatmentByFamily.set(key, signatures)

    if (row.treatmentKind === 'core') {
      const packs = corePacksByFamily.get(key) ?? new Set<string>()
      packs.add(design.stylePackId)
      corePacksByFamily.set(key, packs)
    }
    normalizedRows.push({ row, design, family: effectiveFamily })
  }

  const familyCounts: FirstPartyLaunchCatalogSummary['familyCounts'] = {}
  for (const { row, design } of normalizedRows) {
    const c = familyCounts[design.familyId] ?? { released: 0, core: 0, authoredAlternates: 0, coreStylePacks: 0 }
    c.released++
    if (row.treatmentKind === 'core') c.core++
    else c.authoredAlternates++
    c.coreStylePacks = corePacksByFamily.get(`${design.familyId}@${design.familyRevision}`)?.size ?? 0
    familyCounts[design.familyId] = c
  }

  const eligibleFamilies = families.filter((family) => {
    const c = familyCounts[family.familyId]
    return Boolean(c &&
      c.released >= FIRST_PARTY_TREATMENTS_PER_FAMILY &&
      c.core >= FIRST_PARTY_CORE_TREATMENTS &&
      c.authoredAlternates >= FIRST_PARTY_AUTHORED_ALTERNATES &&
      c.coreStylePacks >= FIRST_PARTY_CORE_TREATMENTS)
  }).length

  if (eligibleFamilies < FIRST_PARTY_LAUNCH_FAMILIES)
    throw new Error(`launch catalog: requires ${FIRST_PARTY_LAUNCH_FAMILIES} eligible first-party families; found ${eligibleFamilies}`)

  for (const family of families) {
    const c = familyCounts[family.familyId]
    if (!c) continue
    if (c.released < FIRST_PARTY_TREATMENTS_PER_FAMILY ||
        c.core < FIRST_PARTY_CORE_TREATMENTS ||
        c.authoredAlternates < FIRST_PARTY_AUTHORED_ALTERNATES ||
        c.coreStylePacks < FIRST_PARTY_CORE_TREATMENTS)
      throw new Error(`launch catalog: family ${family.familyId} needs 25 distinct core style-pack recipes + 15 authored alternates`)
  }

  return { releasedFirstParty: normalizedRows.length, eligibleFamilies, familyCounts }
}

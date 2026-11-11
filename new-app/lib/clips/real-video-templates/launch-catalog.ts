import { validateTemplateEditorialTiming, type TemplateFamilyV1 } from '@/lib/clips/real-video-templates/sequence-contract'

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
  familyId: string
  familyRevision: number
  designId: string
  designRevision: number
  origin: LaunchTreatmentOrigin
  status: LaunchTreatmentStatus
  treatmentKind: LaunchTreatmentKind
  visibleDimensions: readonly VisibleTemplateDimension[]
}

export type FirstPartyLaunchCatalogSummary = {
  releasedFirstParty: number
  eligibleFamilies: number
  familyCounts: Record<string, { released: number; core: number; authoredAlternates: number }>
}

function uniqueDimensions(row: FirstPartyLaunchTreatment): VisibleTemplateDimension[] {
  return [...new Set(row.visibleDimensions)].filter((x): x is VisibleTemplateDimension =>
    (VISIBLE_TEMPLATE_DIMENSIONS as readonly string[]).includes(x),
  )
}

/**
 * B3B launch gate. This validates a supplied first-party catalogue; it intentionally does not
 * synthesize a Cartesian product or count community/draft/failed/incompatible records.
 */
export function assertFirstPartyLaunchCatalog(
  families: readonly TemplateFamilyV1[],
  treatments: readonly FirstPartyLaunchTreatment[],
): FirstPartyLaunchCatalogSummary {
  const familyByRevision = new Map(families.map((f) => [`${f.familyId}@${f.revision}`, f]))
  const seenDesign = new Set<string>()
  const released = treatments.filter((row) => row.origin === 'first-party' && row.status === 'released')

  for (const row of released) {
    const key = `${row.familyId}@${row.familyRevision}`
    const family = familyByRevision.get(key)
    if (!family) throw new Error(`launch catalog: unknown/incompatible family revision ${key}`)
    validateTemplateEditorialTiming(family)
    const designKey = `${key}:${row.designId}@${row.designRevision}`
    if (seenDesign.has(designKey)) throw new Error(`launch catalog: duplicate released design ${designKey}`)
    seenDesign.add(designKey)
    if (uniqueDimensions(row).length < 3)
      throw new Error(`launch catalog: ${row.designId} must differ on at least three visible authored dimensions`)
  }

  const familyCounts: FirstPartyLaunchCatalogSummary['familyCounts'] = {}
  for (const row of released) {
    const c = familyCounts[row.familyId] ?? { released: 0, core: 0, authoredAlternates: 0 }
    c.released++
    if (row.treatmentKind === 'core') c.core++
    else c.authoredAlternates++
    familyCounts[row.familyId] = c
  }

  const eligibleFamilies = Object.entries(familyCounts).filter(([, c]) =>
    c.released >= FIRST_PARTY_TREATMENTS_PER_FAMILY &&
    c.core >= FIRST_PARTY_CORE_TREATMENTS &&
    c.authoredAlternates >= FIRST_PARTY_AUTHORED_ALTERNATES,
  ).length
  if (eligibleFamilies < FIRST_PARTY_LAUNCH_FAMILIES)
    throw new Error(`launch catalog: requires ${FIRST_PARTY_LAUNCH_FAMILIES} eligible first-party families; found ${eligibleFamilies}`)

  for (const family of families) {
    const c = familyCounts[family.familyId]
    if (!c) continue
    if (c.released < FIRST_PARTY_TREATMENTS_PER_FAMILY ||
        c.core < FIRST_PARTY_CORE_TREATMENTS ||
        c.authoredAlternates < FIRST_PARTY_AUTHORED_ALTERNATES)
      throw new Error(`launch catalog: family ${family.familyId} does not have 25 core + 15 authored alternate released treatments`)
  }

  return { releasedFirstParty: released.length, eligibleFamilies, familyCounts }
}

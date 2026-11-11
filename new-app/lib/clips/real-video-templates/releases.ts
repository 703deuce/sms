import { BATCH9A_ANCHOR_RELEASES } from './batch9a-anchors'
import { BATCH9_PHASE_B_CERTIFIED_RELEASES } from './batch9-phase-b-certified'
import { validateVideoTemplateGallery, type VideoTemplateRelease } from './gallery'

/**
 * Batch 9A preview anchors are intentionally visible before certification so users can
 * fill and render them now. Their Preview badge must remain truthful until the existing
 * independent demo/render certification gate is completed.
 */
const firstPartyReleases: VideoTemplateRelease[] = [
  ...BATCH9A_ANCHOR_RELEASES,
  ...BATCH9_PHASE_B_CERTIFIED_RELEASES,
]

export const FIRST_PARTY_VIDEO_TEMPLATES = validateVideoTemplateGallery(firstPartyReleases)

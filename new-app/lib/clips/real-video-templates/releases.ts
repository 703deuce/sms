import { validateVideoTemplateGallery, type VideoTemplateRelease } from './gallery'

/**
 * Only insert records once footage demos, licensed assets and actual frame-level
 * preview/export review exist. Batch 3's schema/compiler alone is not a release.
 * Keeping this empty avoids advertising fabricated "2,000" first-party templates.
 */
const reviewedFirstPartyReleases: VideoTemplateRelease[] = []

export const FIRST_PARTY_VIDEO_TEMPLATES = validateVideoTemplateGallery(reviewedFirstPartyReleases)

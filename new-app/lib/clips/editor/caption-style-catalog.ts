import { presetSlugToId } from '../caption-presets'
import type { ClipEditsV2 } from '../edits'

export type CaptionStyleRole = 'clean' | 'modern'

export type CaptionFeaturedStyle = {
  slug: string
  id: string
  role: CaptionStyleRole
  roleLabel: string
  name: string
}

export const CAPTION_FEATURED_STYLES: Record<'clean_white' | 'bold_pop', CaptionFeaturedStyle> = {
  clean_white: {
    slug: 'clean-white',
    id: 'clean_white',
    role: 'clean',
    roleLabel: 'Clean',
    name: 'Clean White',
  },
  bold_pop: {
    slug: 'bold-pop',
    id: 'bold_pop',
    role: 'modern',
    roleLabel: 'Modern',
    name: 'Bold Pop',
  },
}

export const CAPTION_OPT_IN_COPY = 'Highlight and emoji stay off until you turn them on.'

export function captionStyleRole(
  presetIdOrSlug: string | undefined | null,
): CaptionFeaturedStyle | null {
  const raw = presetIdOrSlug?.trim()
  if (!raw) return null
  const id = raw.includes('-') ? presetSlugToId(raw) : raw
  if (id === CAPTION_FEATURED_STYLES.clean_white.id) return CAPTION_FEATURED_STYLES.clean_white
  if (id === CAPTION_FEATURED_STYLES.bold_pop.id) return CAPTION_FEATURED_STYLES.bold_pop
  return null
}

export function captionHighlightOptedIn(cap: ClipEditsV2['captions'] | undefined): boolean {
  return cap?.activeStyle === 'highlight' || cap?.keywordHighlight === true
}

export function captionEmojiOptedIn(cap: ClipEditsV2['captions'] | undefined): boolean {
  return cap?.autoEmojis === true
}

export function captionOptInsAreOff(cap: ClipEditsV2['captions'] | undefined): boolean {
  return !captionHighlightOptedIn(cap) && !captionEmojiOptedIn(cap)
}

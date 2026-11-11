/** Apply authored B2B caption recipes without carrying over a prior style's
 * visual overrides. Legacy preset switches deliberately retain their old
 * behavior; the 120 new recipes are opt-in only.
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { CaptionPreset } from '@/lib/clips/caption-presets'
import { presetSlugToId } from '@/lib/clips/caption-presets'
import { clearPremiumCaptionStyle } from '@/lib/clips/premium-caption-styles'

export function applyDesignedCaptionPreset(
  cap: ClipEditsV2['captions'],
  recipe: CaptionPreset,
): ClipEditsV2['captions'] {
  const presetId = presetSlugToId(recipe.slug)
  const oldStyle = clearPremiumCaptionStyle(cap)
  if (!recipe.slug.startsWith('b2b-')) {
    // Historical semantics are intentionally untouched.
    return {
      ...oldStyle,
      enabled: cap.enabled !== false,
      presetId,
      customPresetId: undefined,
      animation: recipe.animation,
      size: cap.size ?? recipe.sizePct,
      userSizePct: undefined,
    }
  }
  return {
    ...oldStyle,
    enabled: cap.enabled !== false,
    presetId,
    customPresetId: undefined,
    presetConfig: undefined,
    font: recipe.font,
    animation: recipe.animation,
    size: recipe.sizePct,
    userSizePct: undefined,
    position: recipe.position,
    marginVPct: recipe.marginVPct,
    wordsPerLine: recipe.wordsPerLine,
    case: recipe.case,
    colors: undefined,
    activeStyle: 'color',
    highlightColor: undefined,
  }
}

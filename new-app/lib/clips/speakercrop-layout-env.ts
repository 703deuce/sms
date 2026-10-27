import type { ClipProjectSettings } from '@/lib/clips/settings'
import { clipLayoutModes } from '@/lib/clips/settings'

/** Keys passed to speakercrop subprocess — must match worker/clips_worker/render_clip.layout_env */
export type SpeakercropLayoutEnv = {
  LAYOUT_MODE: string
  LAYOUT_STYLE: string
  SPLIT: string
  MULTIPERSON?: string
  FORCE_SPLIT?: string
}

export function speakercropLayoutEnv(layout: ClipProjectSettings['layout']): SpeakercropLayoutEnv {
  if (!clipLayoutModes.includes(layout)) {
    layout = 'speaker_follow'
  }
  const base = { LEAD: '0.4', MIN_SEG: '0.8', VOICE: '1', CAPTIONS: '1', SAMPLE_FPS: '10' }
  if (layout === 'split') {
    return {
      ...base,
      SPLIT: '1',
      FORCE_SPLIT: '1',
      LAYOUT_MODE: 'split',
      LAYOUT_STYLE: 'split',
      MULTIPERSON: '1',
    }
  }
  if (layout === 'fill') {
    return { ...base, SPLIT: '0', LAYOUT_MODE: 'fill', LAYOUT_STYLE: 'fill' }
  }
  if (layout === 'fit') {
    return { ...base, SPLIT: '0', LAYOUT_MODE: 'fit', LAYOUT_STYLE: 'fit' }
  }
  if (layout === 'dynamic' || layout === 'split_debate' || layout === 'grid' || layout === 'locked_off') {
    return { ...base, SPLIT: '1', LAYOUT_MODE: layout, LAYOUT_STYLE: layout, MULTIPERSON: '1' }
  }
  if (layout === 'auto') {
    return speakercropLayoutEnv('dynamic')
  }
  return {
    ...base,
    SPLIT: '1',
    LAYOUT_MODE: 'speaker_follow',
    LAYOUT_STYLE: 'speaker_follow',
    MULTIPERSON: '1',
  }
}

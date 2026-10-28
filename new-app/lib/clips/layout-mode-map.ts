import type { ClipProjectSettings } from '@/lib/clips/settings'

/** Map clip editor layout mode → worker speakercrop layout (project settings use the worker id directly). */
export function editorLayoutToWorker(mode: string): ClipProjectSettings['layout'] {
  switch (mode) {
    case 'fit_blur':
    case 'fit_top':
    case 'full_frame':
      return 'fit'
    case 'center_crop':
      return 'fill'
    case 'split':
    case 'grid3':
    case 'grid4':
    case 'dynamic':
    case 'auto':
    case 'speaker_follow':
    case 'fill':
    case 'fit':
    case 'split_debate':
    case 'grid':
    case 'locked_off':
      return mode as ClipProjectSettings['layout']
    default:
      return 'speaker_follow'
  }
}

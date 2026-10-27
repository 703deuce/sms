import type { ExportAspect } from '@/lib/clips/export-aspect'

/** Tailwind aspect class for results-grid clip cards (preview is 9:16; card frame matches export intent). */
export function clipCardAspectClass(aspect: ExportAspect = '9:16'): string {
  switch (aspect) {
    case '4:5':
      return 'aspect-[4/5]'
    case '1:1':
      return 'aspect-square'
    case '16:9':
      return 'aspect-video'
    default:
      return 'aspect-[9/16]'
  }
}

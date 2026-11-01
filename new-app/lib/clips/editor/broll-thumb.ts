import type { BrollItem } from '@/lib/clips/broll'

export type BrollMediaRow = {
  id: string
  url?: string | null
  thumbUrl?: string | null
  mediaType?: string | null
}

export type BrollPanelThumb = { kind: 'img' | 'video' | 'none'; src?: string }

/** Pure thumbnail choice for B-roll panel list rows (TL-31 / FV-19). */
export function brollPanelThumb(item: Pick<BrollItem, 'source' | 'still'>, row: BrollMediaRow | undefined): BrollPanelThumb {
  if (row?.thumbUrl) return { kind: 'img', src: row.thumbUrl }
  if (row?.url && (row.mediaType === 'image' || (item.source === 'upload' && item.still))) {
    return { kind: 'img', src: row.url }
  }
  if (row?.url && item.source !== 'stock') return { kind: 'video', src: row.url }
  return { kind: 'none' }
}

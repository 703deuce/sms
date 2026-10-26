import type { BrollItem } from '@/lib/clips/broll'

/** Manual placements are kept when auto B-roll runs again. */
export function isManualBroll(item: BrollItem): boolean {
  return item.placement === 'manual'
}

/** One clean Pixabay query (no comma-joined keyword lists). */
export function cleanPixabayQuery(raw: string): string {
  const first = raw.split(',')[0]?.trim() || raw.trim()
  const words = first.replace(/[^a-zA-Z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
  return words.slice(0, 5).join(' ')
}

export function mergeAutoBrollItems(existing: BrollItem[], newItems: BrollItem[]): BrollItem[] {
  const kept = existing.filter(isManualBroll)
  return [...kept, ...newItems]
}

export function manualBrollOccupied(existing: BrollItem[]) {
  return existing.filter(isManualBroll).map((b) => ({ startMs: b.startMs, endMs: b.endMs }))
}

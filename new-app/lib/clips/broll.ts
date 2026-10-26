export type BrollItem =
  | { id: string; source: 'stock'; assetId: string; startMs: number; endMs: number }
  | { id: string; source: 'ai'; generationId: string; startMs: number; endMs: number }

export const BROLL_MIN_MS = 1000
export const BROLL_DEFAULT_SHOT_MS = 3000

export function clampBrollItem(item: BrollItem, clipEndMs: number): BrollItem {
  const startMs = Math.max(0, Math.min(item.startMs, clipEndMs - BROLL_MIN_MS))
  const endMs = Math.max(startMs + BROLL_MIN_MS, Math.min(item.endMs, clipEndMs))
  return { ...item, startMs, endMs }
}

export function normalizeBrollItems(raw: unknown, clipDurationMs: number): BrollItem[] {
  if (!Array.isArray(raw)) return []
  const out: BrollItem[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const id = String(o.id ?? '')
    const source = o.source === 'ai' ? 'ai' : 'stock'
    const startMs = Number(o.startMs)
    const endMs = Number(o.endMs)
    if (!id || !Number.isFinite(startMs) || !Number.isFinite(endMs)) continue
    if (source === 'ai') {
      const generationId = String(o.generationId ?? '')
      if (!generationId) continue
      out.push(clampBrollItem({ id, source: 'ai', generationId, startMs, endMs }, clipDurationMs))
    } else {
      const assetId = String(o.assetId ?? '')
      if (!assetId) continue
      out.push(clampBrollItem({ id, source: 'stock', assetId, startMs, endMs }, clipDurationMs))
    }
  }
  return out
}

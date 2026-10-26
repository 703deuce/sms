import type { BreakdownTag } from '@/lib/screenwriting/breakdown/types'
import { BREAKDOWN_CATEGORIES } from '@/lib/screenwriting/breakdown/types'

export function breakdownReport(tags: BreakdownTag[]): { category: string; count: number; items: string[] }[] {
  return BREAKDOWN_CATEGORIES.map((category) => {
    const rows = tags.filter((t) => t.category === category)
    return {
      category,
      count: rows.length,
      items: rows.map((t) => t.label || t.elementId),
    }
  }).filter((r) => r.count > 0)
}

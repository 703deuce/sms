import { z } from 'zod'

export const shelfItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  cutAt: z.string().datetime().optional(),
})

export type ShelfItem = z.infer<typeof shelfItemSchema>

export function addToShelf(items: ShelfItem[], text: string, id?: string): ShelfItem[] {
  if (!text.trim()) return items
  return [...items, { id: id ?? `sh_${items.length}`, text, cutAt: new Date().toISOString() }]
}

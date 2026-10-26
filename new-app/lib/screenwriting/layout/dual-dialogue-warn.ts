import type { JSONContent } from '@tiptap/core'
import { layoutElementsFromPmJson, paginateFromElements } from '@/lib/screenwriting/layout'
import type { PaginationOptions } from '@/lib/screenwriting/layout/types'

export function dualDialoguePaginationWarning(doc: JSONContent, options: PaginationOptions): string | null {
  const hasDual = (doc.content ?? []).some((n) => n.type === 'dualDialogue')
  if (!hasDual) return null
  const layout = paginateFromElements(layoutElementsFromPmJson(doc), options)
  const tall = layout.pages.some((p) => p.lines.some((l) => l.text.includes('[dual:')))
  if (tall) return 'Dual dialogue may exceed one page; layout will stack columns.'
  return null
}

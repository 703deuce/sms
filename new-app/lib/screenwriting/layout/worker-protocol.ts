import type { LayoutElement, PaginationOptions, PaginationResult } from '@/lib/screenwriting/layout/types'
import { paginateFromElements, paginateIncremental } from '@/lib/screenwriting/layout/paginate'

export type LayoutWorkerRequest =
  | { type: 'layout-full'; elements: LayoutElement[]; options: PaginationOptions }
  | {
      type: 'layout-incremental'
      elements: LayoutElement[]
      options: PaginationOptions
      fromPage: number
      previous: PaginationResult
    }

export type LayoutWorkerResponse =
  | { type: 'layout-result'; result: PaginationResult }
  | { type: 'layout-error'; message: string }

/** Run layout in main thread (worker wiring uses same protocol). */
export function handleLayoutRequest(req: LayoutWorkerRequest): LayoutWorkerResponse {
  try {
    if (req.type === 'layout-full') {
      return { type: 'layout-result', result: paginateFromElements(req.elements, req.options) }
    }
    const result = paginateIncremental(
      { elements: req.elements, options: req.options },
      req.fromPage,
      req.previous,
    )
    return { type: 'layout-result', result }
  } catch (e) {
    return { type: 'layout-error', message: e instanceof Error ? e.message : 'layout failed' }
  }
}

/** Map a body line index on a page to approximate PM doc position (element id + offset). */
export function pageLineToAnchor(
  result: PaginationResult,
  pageIndex: number,
  lineIndex: number,
): { elementId: string; offset: number } | null {
  const page = result.pages[pageIndex]
  if (!page) return null
  const line = page.lines.find((l) => l.lineIndex === lineIndex && !l.virtual)
  if (!line) return null
  return { elementId: line.elementId, offset: line.offset }
}

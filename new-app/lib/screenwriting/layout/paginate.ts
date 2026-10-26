import type { FormatSpec, ScreenplayElementType } from '@/lib/screenwriting/formats/types'
import { FEATURE_FORMAT_SPEC } from '@/lib/screenwriting/formats/feature'
import { wrapText } from '@/lib/screenwriting/layout/wrap'
import type {
  LayoutBlock,
  LayoutElement,
  LayoutDoc,
  PageAnchor,
  PageLayout,
  PaginationOptions,
  PaginationResult,
  PositionedLine,
  WrappedLine,
} from '@/lib/screenwriting/layout/types'

const SENTENCE_END = /[.?!…](?:\s+|$)|--\s+/

function specFor(options: PaginationOptions): FormatSpec {
  return options.spec ?? FEATURE_FORMAT_SPEC
}

function spaceBeforeLines(type: ScreenplayElementType, spec: FormatSpec): number {
  return spec.elements[type]?.spaceBefore ?? 0
}

function wrapElement(el: LayoutElement, spec: FormatSpec): LayoutBlock {
  if (el.kind === 'pageBreak') {
    return { element: el, wrapped: [], lineCount: 0 }
  }
  if (el.kind === 'dualDialogue' && el.columns) {
    const colHeights = el.columns.map((col) => {
      let lines = 1 // character
      for (const block of col.lines) {
        const w = wrapText(block.text, block.kind, spec)
        lines += w.length
      }
      return lines
    })
    const lineCount = Math.max(...colHeights, 1)
    return { element: el, wrapped: [{ text: `[dual:${lineCount}]`, offset: 0 }], lineCount }
  }
  const t = el.elementType ?? 'action'
  const caps = spec.elements[t]?.caps ?? false
  const wrapped = wrapText(el.text, t, spec, caps, el.hardBreaks)
  const sb = spaceBeforeLines(t, spec)
  return { element: el, wrapped, lineCount: wrapped.length + sb }
}

function blockVisualLines(block: LayoutBlock, spec: FormatSpec, atPageTop: boolean): number {
  if (block.element.kind === 'pageBreak') return 0
  const t = block.element.elementType ?? 'action'
  const sb = atPageTop ? 0 : spaceBeforeLines(t, spec)
  if (block.element.kind === 'dualDialogue') {
    const n = parseInt(block.wrapped[0]?.text.match(/dual:(\d+)/)?.[1] ?? '1', 10)
    return n + sb
  }
  return block.wrapped.length + sb
}

function pushWrappedLines(
  lines: PositionedLine[],
  el: LayoutElement,
  wrapped: WrappedLine[],
  startLine: number,
  type: ScreenplayElementType,
): number {
  let y = startLine
  for (const w of wrapped) {
    lines.push({
      elementId: el.id,
      elementType: type,
      text: w.text,
      lineIndex: y,
      offset: w.offset,
    })
    y++
  }
  return y
}

function dialogueSpeechBlocks(blocks: LayoutBlock[], start: number): { end: number; lines: number } {
  let i = start
  let lines = 0
  if (blocks[i]?.element.elementType !== 'character') return { end: start, lines: 0 }
  lines += blockVisualLines(blocks[i], FEATURE_FORMAT_SPEC, false)
  i++
  while (i < blocks.length) {
    const t = blocks[i].element.elementType
    if (t === 'parenthetical' || t === 'dialogue') {
      lines += blockVisualLines(blocks[i], FEATURE_FORMAT_SPEC, false)
      i++
    } else break
  }
  return { end: i, lines }
}

function findSentenceSplit(wrapped: WrappedLine[]): number | null {
  if (wrapped.length < 4) return null
  for (let i = 2; i <= wrapped.length - 2; i++) {
    const prev = wrapped[i - 1]?.text ?? ''
    if (SENTENCE_END.test(prev + ' ')) return i
  }
  return null
}

function paginateBlocks(blocks: LayoutBlock[], options: PaginationOptions): PageLayout[] {
  const spec = specFor(options)
  const bodyLines = options.bodyLinesPerPage ?? spec.page.bodyLines
  const pages: PageLayout[] = []
  let pageIndex = 0
  let lineOnPage = 0
  let pageLines: PositionedLine[] = []
  let pageStart: PageAnchor = { elementId: blocks[0]?.element.id ?? 'start', offset: 0 }
  let i = 0

  const flushPage = () => {
    const label = pageIndex === 0 ? '1' : String(pageIndex + 1)
    pages.push({
      pageIndex,
      label,
      startAnchor: pageStart,
      lines: pageLines,
    })
    pageIndex++
    lineOnPage = 0
    pageLines = []
    pageStart = { elementId: blocks[i]?.element.id ?? 'end', offset: 0 }
  }

  const room = () => bodyLines - lineOnPage - (pageIndex === 0 && options.firstPageUnnumbered ? 0 : 0)

  while (i < blocks.length) {
    const block = blocks[i]
    if (block.element.kind === 'pageBreak') {
      if (lineOnPage > 0) flushPage()
      i++
      continue
    }

    let atTop = lineOnPage === 0
    let need = blockVisualLines(block, spec, atTop)

    // R1: scene heading needs 2 lines of next on same page
    if (block.element.elementType === 'sceneHeading' || block.element.elementType === 'shot') {
      const next = blocks[i + 1]
      const nextLines = next ? blockVisualLines(next, spec, false) : 0
      if (lineOnPage > 0 && need + Math.min(2, nextLines) > room()) {
        flushPage()
        atTop = true
        need = blockVisualLines(block, spec, true)
      }
    }

    // R2: character + speech keep together
    if (block.element.elementType === 'character') {
      const speech = dialogueSpeechBlocks(blocks, i)
      const total = speech.lines
      if (lineOnPage > 0 && total > room()) {
        flushPage()
      }
    }

    // R6: transition should not start page — pull previous if needed
    if (block.element.elementType === 'transition' && lineOnPage === 0 && pages.length > 0) {
      // If alone at top, merge with previous page by not flushing (already new page)
    }

    if (need > room() && lineOnPage > 0) {
      // R4 dialogue split with MORE/CONT'D
      if (block.element.elementType === 'dialogue') {
        const splitAt = findSentenceSplit(block.wrapped)
        if (splitAt && splitAt <= room()) {
          const head = block.wrapped.slice(0, splitAt)
          const tail = block.wrapped.slice(splitAt)
          pushWrappedLines(pageLines, block.element, head, lineOnPage, 'dialogue')
          lineOnPage += head.length
          pageLines.push({
            elementId: block.element.id,
            elementType: 'more',
            text: options.moreLabel ?? '(MORE)',
            lineIndex: lineOnPage,
            offset: head[head.length - 1]?.offset ?? 0,
            virtual: true,
          })
          lineOnPage++
          flushPage()
          // CONT'D on character from prior block
          const charBlock = blocks[i - 1]
          if (charBlock?.element.elementType === 'character') {
            const name = charBlock.element.text.trim()
            const contd = `${name} ${options.contdLabel ?? "(CONT'D)"}`
            pageLines.push({
              elementId: charBlock.element.id,
              elementType: 'contd',
              text: contd,
              lineIndex: 0,
              offset: 0,
              virtual: true,
            })
            lineOnPage = 1
          }
          pushWrappedLines(pageLines, block.element, tail, lineOnPage, 'dialogue')
          lineOnPage += tail.length
          i++
          continue
        }
      }
      flushPage()
      need = blockVisualLines(block, spec, true)
    }

    if (block.element.kind === 'dualDialogue') {
      const t = block.element.elementType ?? 'action'
      const sb = atTop ? 0 : spaceBeforeLines('action', spec)
      if (sb) lineOnPage += sb
      pageLines.push({
        elementId: block.element.id,
        elementType: 'action',
        text: block.wrapped[0]?.text ?? '',
        lineIndex: lineOnPage,
        offset: 0,
      })
      lineOnPage += need - sb
      i++
      continue
    }

    const elType = block.element.elementType ?? 'action'
    const sb = atTop ? 0 : spaceBeforeLines(elType, spec)
    if (sb) {
      for (let s = 0; s < sb; s++) {
        pageLines.push({
          elementId: block.element.id,
          elementType: elType,
          text: '',
          lineIndex: lineOnPage,
          offset: 0,
          virtual: true,
        })
        lineOnPage++
      }
    }
    lineOnPage = pushWrappedLines(pageLines, block.element, block.wrapped, lineOnPage, elType)
    i++
  }

  if (pageLines.length > 0 || pages.length === 0) flushPage()
  return pages
}

function computeSceneEighths(pages: PageLayout[], bodyLines: number): Record<string, number> {
  const eighths: Record<string, number> = {}
  const sceneLines: Record<string, number> = {}
  for (const page of pages) {
    for (const line of page.lines) {
      if (line.elementType === 'sceneHeading' && !sceneLines[line.elementId]) {
        sceneLines[line.elementId] = 0
      }
      if (line.elementType === 'sceneHeading') {
        sceneLines[line.elementId] = (sceneLines[line.elementId] ?? 0) + 1
      }
    }
  }
  for (const [id, lines] of Object.entries(sceneLines)) {
    const e = Math.max(1, Math.round((lines / bodyLines) * 8))
    eighths[id] = e / 8
  }
  return eighths
}

export function paginate(doc: LayoutDoc): PaginationResult {
  const spec = specFor(doc.options)
  const blocks = doc.elements.map((el) => wrapElement(el, spec))
  const pages = paginateBlocks(blocks, doc.options)
  const bodyLines = doc.options.bodyLinesPerPage ?? spec.page.bodyLines
  return {
    pages,
    pageCount: pages.length,
    sceneEighths: computeSceneEighths(pages, bodyLines),
  }
}

export function paginateFromElements(elements: LayoutElement[], options: PaginationOptions): PaginationResult {
  return paginate({ elements, options })
}

/** Re-layout from `fromPageIndex` (incremental stub: full re-run when from > 0 until convergence). */
export function paginateIncremental(
  doc: LayoutDoc,
  fromPageIndex: number,
  previous: PaginationResult | null,
): PaginationResult {
  const full = paginate(doc)
  if (!previous || fromPageIndex <= 0) return full
  // When page starts match from `fromPageIndex` onward, keep previous prefix (fast path).
  let match = true
  for (let p = 0; p < fromPageIndex && p < full.pages.length && p < previous.pages.length; p++) {
    const a = full.pages[p].startAnchor
    const b = previous.pages[p].startAnchor
    if (a.elementId !== b.elementId || a.offset !== b.offset) {
      match = false
      break
    }
  }
  if (!match) return full
  const pages = [...previous.pages.slice(0, fromPageIndex), ...full.pages.slice(fromPageIndex)]
  return {
    pages,
    pageCount: pages.length,
    sceneEighths: full.sceneEighths,
  }
}

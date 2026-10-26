import type { FormatSpec, ScreenplayElementType } from '@/lib/screenwriting/formats/types'

export type LayoutElementKind = ScreenplayElementType | 'pageBreak' | 'dualDialogue'

export interface LayoutElement {
  id: string
  kind: LayoutElementKind
  elementType?: ScreenplayElementType
  text: string
  /** Hard line breaks inside element (Shift+Enter). */
  hardBreaks?: number[]
  caps?: boolean
  /** Dual dialogue: two columns of speech blocks. */
  columns?: LayoutSpeechColumn[]
}

export interface LayoutSpeechColumn {
  character: string
  characterId: string
  lines: LayoutInlineBlock[]
}

export interface LayoutInlineBlock {
  kind: 'parenthetical' | 'dialogue'
  id: string
  text: string
}

export interface WrappedLine {
  text: string
  /** Start offset in source text (for anchors). */
  offset: number
}

export interface LayoutBlock {
  element: LayoutElement
  wrapped: WrappedLine[]
  /** Visual lines including space-before blank if any. */
  lineCount: number
}

export interface PageAnchor {
  elementId: string
  offset: number
}

export interface PositionedLine {
  elementId: string
  elementType: ScreenplayElementType | 'more' | 'contd' | 'continued'
  text: string
  lineIndex: number
  offset: number
  virtual?: boolean
}

export interface PageLayout {
  pageIndex: number
  label: string
  startAnchor: PageAnchor
  lines: PositionedLine[]
  sceneNumberLeft?: string
  sceneNumberRight?: string
}

export interface PaginationOptions {
  spec: FormatSpec
  /** Body lines per page (after header reserve). */
  bodyLinesPerPage?: number
  /** Page 1 hides header (one extra body line). */
  firstPageUnnumbered?: boolean
  moreLabel?: string
  contdLabel?: string
  sceneContinued?: boolean
}

export interface PaginationResult {
  pages: PageLayout[]
  pageCount: number
  sceneEighths: Record<string, number>
}

export interface LayoutDoc {
  elements: LayoutElement[]
  options: PaginationOptions
}

import type { CSSProperties } from 'react'
import type { FormatSpec, ScreenplayElementType } from '@/lib/screenwriting/formats/types'

export function elementStyle(spec: FormatSpec, elementType: ScreenplayElementType): CSSProperties {
  const el = spec.elements[elementType]
  const leftCh = (el.left - spec.page.marginLeft) * spec.page.charsPerInch
  const rightCh = (spec.page.widthIn - spec.page.marginRight - el.right) * spec.page.charsPerInch
  const textTransform = el.caps ? 'uppercase' : 'none'
  const textAlign = el.align === 'right' ? 'right' : el.align === 'center' ? 'center' : 'left'
  return {
    marginLeft: `${leftCh}ch`,
    marginRight: `${rightCh}ch`,
    marginTop: el.spaceBefore ? '1em' : 0,
    textTransform,
    textAlign,
    fontFamily: '"Courier Prime", "Courier New", Courier, monospace',
    fontSize: '12pt',
    lineHeight: '1em',
    whiteSpace: 'pre-wrap',
    minHeight: '1em',
  }
}

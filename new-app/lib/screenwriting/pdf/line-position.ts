import type { FormatSpec, ScreenplayElementType } from '@/lib/screenwriting/formats/types'

export function pdfLineBox(
  spec: FormatSpec,
  elementType: ScreenplayElementType | 'more' | 'contd' | 'continued',
): { x: number; width: number; align: 'left' | 'center' | 'right' } {
  const t = (elementType === 'more' || elementType === 'contd' || elementType === 'continued'
    ? 'action'
    : elementType) as ScreenplayElementType
  const el = spec.elements[t] ?? spec.elements.action!
  const pageW = spec.page.widthIn * 72
  const x = el.left * 72
  const right = el.right * 72
  const width = Math.max(24, pageW - right - x)
  const align = el.align === 'right' ? 'right' : el.align === 'center' ? 'center' : 'left'
  return { x, width, align }
}

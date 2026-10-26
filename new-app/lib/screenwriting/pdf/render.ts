import type { JSONContent } from '@tiptap/core'
import PDFDocument from 'pdfkit'
import { FEATURE_FORMAT_SPEC } from '@/lib/screenwriting/formats/feature'
import { layoutElementsFromPmJson, paginateFromElements } from '@/lib/screenwriting/layout'

export interface PdfRenderOptions {
  title?: string
  includeTitlePage?: boolean
}

export async function renderScriptPdf(doc: JSONContent, options: PdfRenderOptions = {}): Promise<Buffer> {
  const elements = layoutElementsFromPmJson(doc)
  const layout = paginateFromElements(elements, {
    spec: FEATURE_FORMAT_SPEC,
    bodyLinesPerPage: FEATURE_FORMAT_SPEC.page.bodyLines,
    firstPageUnnumbered: true,
  })

  const pdf = new PDFDocument({ size: 'LETTER', margin: 0 })
  const chunks: Buffer[] = []
  pdf.on('data', (c: Buffer) => chunks.push(c))

  const pageW = FEATURE_FORMAT_SPEC.page.widthIn * 72
  const pageH = FEATURE_FORMAT_SPEC.page.heightIn * 72
  const marginTop = FEATURE_FORMAT_SPEC.page.marginTop * 72
  const marginLeft = FEATURE_FORMAT_SPEC.page.marginLeft * 72
  const lineHeight = 12

  if (options.includeTitlePage !== false && options.title) {
    pdf.font('Courier').fontSize(12)
    pdf.text(options.title, marginLeft, pageH / 2, { align: 'center', width: pageW - marginLeft * 2 })
    pdf.addPage()
  }

  for (let pi = 0; pi < layout.pages.length; pi++) {
    const page = layout.pages[pi]
    if (pi > 0) pdf.addPage()
    pdf.font('Courier').fontSize(12)
    const showNumber = pi > 0
    if (showNumber) {
      pdf.text(`${pi + 1}.`, pageW - marginLeft - 24, marginTop - 14, { width: 24, align: 'right' })
    }
    for (const line of page.lines) {
      const y = marginTop + line.lineIndex * lineHeight
      if (line.virtual && !line.text) continue
      pdf.text(line.text, marginLeft, y, { width: pageW - marginLeft * 2, lineBreak: false })
    }
  }

  pdf.end()
  await new Promise<void>((resolve) => pdf.on('end', () => resolve()))
  return Buffer.concat(chunks)
}

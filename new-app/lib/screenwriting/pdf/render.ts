import type { JSONContent } from '@tiptap/core'
import PDFDocument from 'pdfkit'
import { FEATURE_FORMAT_SPEC } from '@/lib/screenwriting/formats/feature'
import { layoutElementsFromPmJson, paginateFromElements } from '@/lib/screenwriting/layout'
import { formatEpisodeHeaderPdfLine, type EpisodeHeader } from '@/lib/screenwriting/tv/episode-header'
import { pdfLineBox } from '@/lib/screenwriting/pdf/line-position'
import type { ScreenplayElementType } from '@/lib/screenwriting/formats/types'

export interface PdfRenderOptions {
  title?: string
  includeTitlePage?: boolean
  watermark?: string
  episodeHeader?: EpisodeHeader
  sceneNumbers?: boolean
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
    if (options.episodeHeader) {
      const line = formatEpisodeHeaderPdfLine(options.episodeHeader)
      if (line) pdf.text(line, marginLeft, pageH / 2 + 24, { align: 'center', width: pageW - marginLeft * 2 })
    }
    pdf.addPage()
  }

  const wm = options.watermark?.trim()

  for (let pi = 0; pi < layout.pages.length; pi++) {
    const page = layout.pages[pi]
    if (pi > 0) pdf.addPage()
    pdf.font('Courier').fontSize(12)
    if (wm) {
      pdf.save()
      pdf.fillColor('#cccccc')
      pdf.fontSize(48)
      pdf.rotate(-35, { origin: [pageW / 2, pageH / 2] })
      pdf.text(wm, pageW / 4, pageH / 2, { align: 'center', width: pageW / 2 })
      pdf.restore()
      pdf.fillColor('#000000')
      pdf.fontSize(12)
    }
    const showNumber = pi > 0 && options.sceneNumbers !== false
    if (showNumber) {
      pdf.text(`${pi + 1}.`, pageW - marginLeft - 24, marginTop - 14, { width: 24, align: 'right' })
    }
    for (const line of page.lines) {
      const y = marginTop + line.lineIndex * lineHeight
      if (line.virtual && !line.text) continue
      const box = pdfLineBox(FEATURE_FORMAT_SPEC, line.elementType as ScreenplayElementType)
      const text = line.elementType === 'character' ? line.text.toUpperCase() : line.text
      pdf.text(text, box.x, y, { width: box.width, align: box.align, lineBreak: false })
    }
  }

  pdf.end()
  await new Promise<void>((resolve) => pdf.on('end', () => resolve()))
  return Buffer.concat(chunks)
}

import type { TitlePage } from '@/lib/screenwriting/meta/title-page'

/** Final Draft TitlePage XML fragment from editor meta. */
export function titlePageToFdxXml(tp: TitlePage): Record<string, unknown> | undefined {
  const content: Record<string, unknown>[] = []
  const push = (label: string, text: string) => {
    if (!text.trim()) return
    content.push({
      '@_Alignment': 'Center',
      Text: { '#text': text },
      '@_Type': label,
    })
  }
  push('Title', tp.title ?? '')
  push('Credit', tp.credit ?? '')
  push('Author', tp.authors ?? '')
  push('Source', tp.source ?? '')
  push('Draft Date', tp.draftDate ?? '')
  push('Contact', tp.contact ?? '')
  push('Copyright', tp.copyright ?? '')
  if (!content.length) return undefined
  return { Content: { Paragraph: content } }
}

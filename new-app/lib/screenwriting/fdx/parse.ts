import { XMLParser } from 'fast-xml-parser'
import type { JSONContent } from '@tiptap/core'
import { newElementId } from '@/lib/screenwriting/schema/empty-doc'
import type { ScreenplayElementType } from '@/lib/screenwriting/formats/types'
import { FDX_TYPE_MAP } from '@/lib/screenwriting/fdx/types'

function textFromParagraph(p: Record<string, unknown>): string {
  const text = p.Text
  if (typeof text === 'string') return text
  if (Array.isArray(text)) {
    return text
      .map((t) => {
        if (typeof t === 'string') return t
        if (t && typeof t === 'object' && '#text' in t) return String((t as { '#text': string })['#text'])
        return ''
      })
      .join('')
  }
  if (text && typeof text === 'object' && '#text' in text) return String((text as { '#text': string })['#text'])
  return ''
}

function mapType(fdxType: string): ScreenplayElementType {
  return (FDX_TYPE_MAP[fdxType] as ScreenplayElementType) || 'general'
}

function paragraphNode(p: Record<string, unknown>): JSONContent | null {
  const typeAttr = (p['@_Type'] as string) || 'Action'
  if (typeAttr === 'Dual Dialogue') return null
  const elementType = mapType(typeAttr)
  const custom = p['@_Type'] && !FDX_TYPE_MAP[typeAttr] ? String(typeAttr) : undefined
  return {
    type: 'screenplayElement',
    attrs: {
      id: newElementId(),
      elementType,
      ...(custom ? { customType: custom } : {}),
    },
    content: [{ type: 'text', text: textFromParagraph(p) }],
  }
}

export interface FdxImportResult {
  pmJson: JSONContent
  unknownFdx?: Record<string, unknown>
  smartType?: Record<string, unknown>
  titlePage?: Record<string, unknown>
}

export function parseFdx(xml: string): FdxImportResult {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
    trimValues: true,
  })
  const root = parser.parse(xml) as Record<string, unknown>
  const fd = (root.FinalDraft ?? root.finaldraft ?? root) as Record<string, unknown>
  const content = fd.Content as Record<string, unknown> | undefined
  const paragraphs = content?.Paragraph
  const list = Array.isArray(paragraphs) ? paragraphs : paragraphs ? [paragraphs] : []

  const nodes: JSONContent[] = []
  for (const p of list) {
    if (!p || typeof p !== 'object') continue
    const node = paragraphNode(p as Record<string, unknown>)
    if (node) nodes.push(node)
  }

  if (!nodes.length) {
    nodes.push({
      type: 'screenplayElement',
      attrs: { id: newElementId(), elementType: 'action' },
      content: [],
    })
  }

  const smartType = fd.SmartType as Record<string, unknown> | undefined
  const titlePage = fd.TitlePage as Record<string, unknown> | undefined
  const unknownFdx: Record<string, unknown> = {}
  for (const key of Object.keys(fd)) {
    if (!['Content', 'SmartType', 'TitlePage', 'ElementSettings', 'PageLayout'].includes(key)) {
      unknownFdx[key] = fd[key]
    }
  }

  return {
    pmJson: { type: 'doc', content: nodes },
    unknownFdx: Object.keys(unknownFdx).length ? unknownFdx : undefined,
    smartType,
    titlePage,
  }
}

export function countFdxElementTypes(xml: string): Record<string, number> {
  const { pmJson } = parseFdx(xml)
  const counts: Record<string, number> = {}
  for (const n of pmJson.content ?? []) {
    if (n.type !== 'screenplayElement') continue
    const t = (n.attrs?.elementType as string) || 'action'
    counts[t] = (counts[t] ?? 0) + 1
  }
  return counts
}

import { XMLBuilder } from 'fast-xml-parser'
import type { JSONContent } from '@tiptap/core'
import type { ScreenplayElementType } from '@/lib/screenwriting/formats/types'
import type { TitlePage } from '@/lib/screenwriting/meta/title-page'
import { titlePageToFdxXml } from '@/lib/screenwriting/fdx/title-page-xml'

const TO_FDX: Record<ScreenplayElementType, string> = {
  sceneHeading: 'Scene Heading',
  action: 'Action',
  character: 'Character',
  parenthetical: 'Parenthetical',
  dialogue: 'Dialogue',
  transition: 'Transition',
  shot: 'Shot',
  general: 'General',
  lyrics: 'Lyrics',
  castList: 'Cast List',
  centered: 'Centered Text',
  actBreak: 'New Act',
}

function nodeText(node: JSONContent): string {
  if (!node.content) return ''
  return node.content.map((c) => (c.type === 'text' ? c.text ?? '' : '')).join('')
}

export function pmJsonToFdx(
  doc: JSONContent,
  extras?: { unknownFdx?: Record<string, unknown>; titlePage?: TitlePage },
): string {
  const paragraphs = (doc.content ?? [])
    .filter((n) => n.type === 'screenplayElement')
    .map((n) => {
      const t = (n.attrs?.elementType as ScreenplayElementType) || 'action'
      const custom = n.attrs?.customType as string | undefined
      const fdxType = custom || TO_FDX[t] || 'General'
      const text = nodeText(n)
      return {
        '@_Type': fdxType,
        Text: text ? { '#text': text } : undefined,
      }
    })

  const titlePageXml = extras?.titlePage ? titlePageToFdxXml(extras.titlePage) : undefined
  const finalDraft: Record<string, unknown> = {
    '@_Version': '5',
    ...(titlePageXml ? { TitlePage: titlePageXml } : {}),
    Content: { Paragraph: paragraphs },
    ...(extras?.unknownFdx ?? {}),
  }

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    format: true,
    suppressEmptyNode: true,
  })
  return builder.build({ FinalDraft: finalDraft })
}

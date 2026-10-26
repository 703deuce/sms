import type { JSONContent } from '@tiptap/core'
import type { ScreenplayElementType } from '@/lib/screenwriting/formats/types'

export interface FindReplaceOptions {
  query: string
  replacement: string
  caseSensitive?: boolean
  wholeWord?: boolean
  regex?: boolean
  scope?: 'all' | 'selection' | 'elementType' | 'characterDialogue'
  elementType?: ScreenplayElementType
  characterName?: string
}

function nodeText(node: JSONContent): string {
  if (!node.content) return ''
  return node.content.map((c) => (c.type === 'text' ? c.text ?? '' : '')).join('')
}

function setNodeText(node: JSONContent, text: string): JSONContent {
  return { ...node, content: text ? [{ type: 'text', text }] : [] }
}

function matches(text: string, query: string, opts: FindReplaceOptions): boolean {
  if (!opts.regex) {
    const hay = opts.caseSensitive ? text : text.toLowerCase()
    const needle = opts.caseSensitive ? query : query.toLowerCase()
    if (opts.wholeWord) return new RegExp(`\\b${needle}\\b`).test(hay)
    return hay.includes(needle)
  }
  const re = new RegExp(query, opts.caseSensitive ? '' : 'i')
  return re.test(text)
}

function replaceIn(text: string, opts: FindReplaceOptions): string {
  if (!opts.regex) {
    const flags = opts.caseSensitive ? 'g' : 'gi'
    const pattern = opts.wholeWord ? `\\b${opts.query}\\b` : opts.query
    return text.replace(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags), opts.replacement)
  }
  return text.replace(new RegExp(opts.query, opts.caseSensitive ? 'g' : 'gi'), opts.replacement)
}

export function applyFindReplace(doc: JSONContent, opts: FindReplaceOptions): JSONContent {
  let lastCharacter = ''
  const content = (doc.content ?? []).map((node) => {
    if (node.type !== 'screenplayElement') return node
    const t = (node.attrs?.elementType as ScreenplayElementType) || 'action'
    const text = nodeText(node)
    if (t === 'character') lastCharacter = text.trim()
    let inScope = opts.scope === 'all' || !opts.scope
    if (opts.scope === 'elementType' && opts.elementType) inScope = t === opts.elementType
    if (opts.scope === 'characterDialogue' && opts.characterName) {
      inScope = t === 'dialogue' && lastCharacter.toUpperCase() === opts.characterName.toUpperCase()
    }
    if (!inScope || !matches(text, opts.query, opts)) return node
    return setNodeText(node, replaceIn(text, opts))
  })
  return { ...doc, content }
}

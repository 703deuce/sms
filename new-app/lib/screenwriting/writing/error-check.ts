import type { JSONContent } from '@tiptap/core'
import type { ScreenplayElementType } from '@/lib/screenwriting/formats/types'

export type ScriptIssueCode =
  | 'empty_element'
  | 'character_without_dialogue'
  | 'stray_parenthetical'
  | 'duplicate_scene_number'

export interface ScriptIssue {
  code: ScriptIssueCode
  elementId?: string
  message: string
}

function nodeText(node: { content?: { type?: string; text?: string }[] }): string {
  if (!node.content) return ''
  return node.content.map((c) => (c.type === 'text' ? c.text ?? '' : '')).join('')
}

export function checkScript(doc: JSONContent): ScriptIssue[] {
  const issues: ScriptIssue[] = []
  const sceneNumbers = new Set<string>()
  let pendingCharacter: { id: string; name: string } | null = null

  for (const node of doc.content ?? []) {
    if (node.type !== 'screenplayElement') continue
    const id = node.attrs?.id as string
    const t = (node.attrs?.elementType as ScreenplayElementType) || 'action'
    const text = nodeText(node).trim()

    if (!text && t !== 'action') {
      issues.push({ code: 'empty_element', elementId: id, message: `Empty ${t}` })
    }

    if (t === 'parenthetical' && !pendingCharacter) {
      issues.push({ code: 'stray_parenthetical', elementId: id, message: 'Parenthetical without character' })
    }

    if (t === 'character') {
      if (pendingCharacter) {
        issues.push({
          code: 'character_without_dialogue',
          elementId: pendingCharacter.id,
          message: `${pendingCharacter.name} has no dialogue`,
        })
      }
      pendingCharacter = { id, name: text }
    } else if (t === 'dialogue') {
      pendingCharacter = null
    } else if (t === 'parenthetical') {
      // keep pending character
    } else if (pendingCharacter) {
      issues.push({
        code: 'character_without_dialogue',
        elementId: pendingCharacter.id,
        message: `${pendingCharacter.name} has no dialogue`,
      })
      pendingCharacter = null
    }

    if (t === 'sceneHeading') {
      const num = (node.attrs?.sceneNumber as string) || ''
      if (num) {
        if (sceneNumbers.has(num)) {
          issues.push({ code: 'duplicate_scene_number', elementId: id, message: `Duplicate scene #${num}` })
        }
        sceneNumbers.add(num)
      }
    }
  }

  if (pendingCharacter) {
    issues.push({
      code: 'character_without_dialogue',
      elementId: pendingCharacter.id,
      message: `${pendingCharacter.name} has no dialogue`,
    })
  }

  return issues
}

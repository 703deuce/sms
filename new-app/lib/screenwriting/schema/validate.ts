import type { JSONContent } from '@tiptap/core'

export function validateScreenplayDocJson(doc: JSONContent): { ok: true } | { ok: false; error: string } {
  if (doc.type !== 'doc' || !Array.isArray(doc.content)) {
    return { ok: false, error: 'root must be doc with content' }
  }
  for (const node of doc.content) {
    const err = validateBlock(node)
    if (err) return { ok: false, error: err }
  }
  return { ok: true }
}

function validateBlock(node: JSONContent): string | null {
  if (node.type === 'pageBreak') return null
  if (node.type === 'dualDialogue') {
    const cols = node.content ?? []
    if (cols.length !== 2) return 'dualDialogue must have exactly 2 dialogueColumn children'
    for (const col of cols) {
      if (col.type !== 'dialogueColumn') return 'dualDialogue children must be dialogueColumn'
    }
    return null
  }
  if (node.type === 'screenplayElement') return null
  return `unknown block type: ${node.type}`
}

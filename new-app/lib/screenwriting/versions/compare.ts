import type { JSONContent } from '@tiptap/core'
import { diff_match_patch } from 'diff-match-patch'

export interface AlignedElement {
  id: string
  type: string
  textA: string
  textB: string
}

function flattenElements(doc: JSONContent): { id: string; type: string; text: string }[] {
  const out: { id: string; type: string; text: string }[] = []
  for (const n of doc.content ?? []) {
    if (n.type !== 'screenplayElement') continue
    const text = (n.content ?? []).map((c) => (c.type === 'text' ? c.text ?? '' : '')).join('')
    out.push({
      id: (n.attrs?.id as string) || `anon-${out.length}`,
      type: (n.attrs?.elementType as string) || 'action',
      text,
    })
  }
  return out
}

/** Align by stable element id; unmatched rows appended in order. */
export function alignElements(a: JSONContent, b: JSONContent): AlignedElement[] {
  const left = flattenElements(a)
  const right = flattenElements(b)
  const byId = new Map(right.map((r) => [r.id, r]))
  const aligned: AlignedElement[] = []
  const used = new Set<string>()
  for (const el of left) {
    const match = byId.get(el.id)
    if (match) {
      used.add(match.id)
      aligned.push({ id: el.id, type: el.type, textA: el.text, textB: match.text })
    } else {
      aligned.push({ id: el.id, type: el.type, textA: el.text, textB: '' })
    }
  }
  for (const el of right) {
    if (!used.has(el.id)) {
      aligned.push({ id: el.id, type: el.type, textA: '', textB: el.text })
    }
  }
  return aligned
}

export function wordDiffHtml(textA: string, textB: string): string {
  const dmp = new diff_match_patch()
  const diffs = dmp.diff_main(textA, textB)
  dmp.diff_cleanupSemantic(diffs)
  return diffs
    .map(([op, text]) => {
      if (op === 1) return `<ins>${escapeHtml(text)}</ins>`
      if (op === -1) return `<del>${escapeHtml(text)}</del>`
      return escapeHtml(text)
    })
    .join('')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

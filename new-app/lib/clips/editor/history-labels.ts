import type { ClipEditsV2 } from '@/lib/clips/edits'

const ORDER: (keyof ClipEditsV2)[] = [
  'cutRanges',
  'trim',
  'captions',
  'captionLines',
  'textItems',
  'layout',
  'audio',
  'broll',
  'color',
  'wordFixes',
]

function jsonKey(edits: ClipEditsV2, key: keyof ClipEditsV2): string {
  return JSON.stringify(edits[key] ?? null)
}

/** Human label for one undo step from `prev` → `next`. */
export function describeEditsChange(prev: ClipEditsV2, next: ClipEditsV2): string {
  if (jsonKey(prev, 'cutRanges') !== jsonKey(next, 'cutRanges')) return 'Cut'
  if (jsonKey(prev, 'trim') !== jsonKey(next, 'trim')) return 'Trim'
  if (jsonKey(prev, 'captions') !== jsonKey(next, 'captions') || jsonKey(prev, 'captionLines') !== jsonKey(next, 'captionLines'))
    return 'Captions'
  if (jsonKey(prev, 'textItems') !== jsonKey(next, 'textItems')) return 'Text'
  if (jsonKey(prev, 'layout') !== jsonKey(next, 'layout')) return 'Layout'
  if (jsonKey(prev, 'audio') !== jsonKey(next, 'audio')) return 'Audio'
  if (jsonKey(prev, 'broll') !== jsonKey(next, 'broll')) return 'B-roll'
  if (jsonKey(prev, 'color') !== jsonKey(next, 'color')) return 'Color'
  if (jsonKey(prev, 'wordFixes') !== jsonKey(next, 'wordFixes')) return 'Word fix'
  for (const key of ORDER) {
    if (jsonKey(prev, key) !== jsonKey(next, key)) return 'Edit'
  }
  return 'Edit'
}

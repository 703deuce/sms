import type { JSONContent } from '@tiptap/core'
import { alignElements } from '@/lib/screenwriting/versions/compare'

export interface MergeSuggestion {
  elementId: string
  suggestion: 'accept_branch' | 'keep_trunk'
  branchText: string
  trunkText: string
}

export function branchMergeSuggestions(trunk: JSONContent, branch: JSONContent): MergeSuggestion[] {
  const aligned = alignElements(trunk, branch)
  return aligned
    .filter((r) => r.textA !== r.textB && r.textB)
    .map((r) => ({
      elementId: r.id,
      suggestion: 'accept_branch' as const,
      branchText: r.textB,
      trunkText: r.textA,
    }))
}

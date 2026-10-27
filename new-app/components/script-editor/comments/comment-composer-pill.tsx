'use client'

import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CommentComposerPill({
  preview,
  onExpand,
}: {
  preview: string
  onExpand: () => void
}) {
  return (
    <button
      type="button"
      className="mb-2 flex h-9 w-full items-center gap-2 rounded-full border border-border bg-muted/60 px-3 text-left text-xs hover:bg-muted"
      onClick={onExpand}
      data-testid="comment-composer-pill"
    >
      <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="truncate text-muted-foreground">{preview || 'Add a comment…'}</span>
      <span className="ml-auto text-[10px] text-muted-foreground">Expand</span>
    </button>
  )
}

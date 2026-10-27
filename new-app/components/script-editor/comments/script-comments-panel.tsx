'use client'

import { useMemo, useState } from 'react'
import { Check, MessageSquare, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { CommentThreadDto } from '@/lib/server/clips/composition-comments'
import { formatScriptTimecode } from '@/lib/clips/script-editor/sync-playhead'

type SortMode = 'timestamp' | 'oldest' | 'newest'

export function ScriptCommentsPanel({
  threads,
  loading,
  playheadOutMs,
  showResolved,
  onToggleShowResolved,
  onSeek,
  onReply,
  onResolve,
  draftComposer,
}: {
  threads: CommentThreadDto[]
  loading: boolean
  playheadOutMs: number
  showResolved: boolean
  onToggleShowResolved: () => void
  onSeek: (outMs: number) => void
  onReply: (threadId: string, body: string) => Promise<void>
  onResolve: (threadId: string, resolved: boolean) => Promise<void>
  draftComposer?: React.ReactNode
}) {
  const [sort, setSort] = useState<SortMode>('timestamp')
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({})

  const visible = useMemo(() => {
    let list = threads.filter((t) => showResolved || !t.resolvedAt)
    if (sort === 'oldest') list = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    if (sort === 'newest') list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return list
  }, [threads, showResolved, sort])

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="script-comments-panel">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquare className="size-4" aria-hidden />
          Comments
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Comment options">
                <SlidersHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-[220px]">
            <DropdownMenuItem onClick={() => setSort('timestamp')}>
              {sort === 'timestamp' ? '✓ ' : ''}Sort by timestamp
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSort('oldest')}>Sort by oldest</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSort('newest')}>Sort by newest</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onToggleShowResolved}>
              {showResolved ? '✓ ' : ''}Show resolved comments
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {draftComposer}
        {loading && <p className="text-xs text-muted-foreground">Loading comments…</p>}
        {!loading && visible.length === 0 && !draftComposer && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <MessageSquare className="size-6 text-muted-foreground" aria-hidden />
            <p className="text-sm font-semibold">No comments yet</p>
            <p className="text-xs text-muted-foreground">Select text and press ⌘⌥M to comment</p>
          </div>
        )}
        {visible.map((thread) => {
          const active =
            playheadOutMs >= thread.startOutMs &&
            playheadOutMs <= Math.max(thread.endOutMs, thread.startOutMs + 1)
          const first = thread.comments[0]
          return (
            <article
              key={thread.id}
              className={cn(
                'rounded-[10px] border border-border bg-card p-3 text-[13px]',
                active && 'ring-1 ring-primary',
                thread.resolvedAt && 'opacity-60',
              )}
            >
              <button
                type="button"
                className="mb-2 font-mono text-xs text-primary hover:underline"
                onClick={() => onSeek(thread.startOutMs)}
              >
                {formatScriptTimecode(thread.startOutMs)}
              </button>
              {thread.quoteText && (
                <p className="mb-2 border-l-2 border-primary/40 pl-2 text-xs italic text-muted-foreground">
                  {thread.quoteText}
                </p>
              )}
              {first && (
                <p className="mb-1">
                  <span className="font-semibold">{first.authorName}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{first.body}</span>
                </p>
              )}
              {thread.comments.slice(1).map((c) => (
                <p key={c.id} className="mt-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{c.authorName}:</span> {c.body}
                </p>
              ))}
              {!thread.resolvedAt && (
                <div className="mt-2 flex gap-2">
                  <input
                    className="h-9 flex-1 rounded-lg border border-input bg-muted px-2 text-xs"
                    placeholder="Reply…"
                    value={replyDraft[thread.id] ?? ''}
                    onChange={(e) => setReplyDraft((d) => ({ ...d, [thread.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        const body = (replyDraft[thread.id] ?? '').trim()
                        if (!body) return
                        void onReply(thread.id, body).then(() =>
                          setReplyDraft((d) => ({ ...d, [thread.id]: '' })),
                        )
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    title="Resolve"
                    onClick={() => void onResolve(thread.id, true)}
                  >
                    <Check className="size-4" />
                  </Button>
                </div>
              )}
              {thread.resolvedAt && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="mt-2 h-7 text-xs"
                  onClick={() => void onResolve(thread.id, false)}
                >
                  Reopen
                </Button>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}

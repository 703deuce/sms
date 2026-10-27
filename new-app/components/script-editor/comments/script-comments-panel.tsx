'use client'

import { useMemo, useState } from 'react'
import { Check, MessageSquare, MoreHorizontal, SlidersHorizontal } from 'lucide-react'
import { formatRelativeTime } from '@/lib/format-relative-time'
import { toast } from 'sonner'
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
  onDeleteThread,
  onEditComment,
  projectId,
  draftComposer,
  clipScope,
  commentScope,
  onCommentScopeChange,
}: {
  threads: CommentThreadDto[]
  loading: boolean
  playheadOutMs: number
  showResolved: boolean
  onToggleShowResolved: () => void
  onSeek: (outMs: number) => void
  onReply: (threadId: string, body: string) => Promise<void>
  onResolve: (threadId: string, resolved: boolean) => Promise<void>
  onDeleteThread?: (threadId: string) => Promise<void>
  onEditComment?: (threadId: string, commentId: string, body: string) => Promise<void>
  projectId?: string
  draftComposer?: React.ReactNode
  clipScope?: boolean
  commentScope?: 'clip' | 'full'
  onCommentScopeChange?: (scope: 'clip' | 'full') => void
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
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                const text = threads
                  .map((t) => {
                    const ts = t.comments[0]?.body ?? ''
                    return `[${formatScriptTimecode(t.startOutMs)}] ${ts}`
                  })
                  .join('\n')
                void navigator.clipboard.writeText(text)
              }}
            >
              Copy all comments
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {clipScope && onCommentScopeChange && (
        <div className="flex gap-1 border-b border-border px-3 py-2">
          {(['clip', 'full'] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={cn(
                'h-7 flex-1 rounded-md text-xs font-medium',
                commentScope === s ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50',
              )}
              onClick={() => onCommentScopeChange(s)}
            >
              {s === 'clip' ? 'This clip' : 'Full video'}
            </button>
          ))}
        </div>
      )}

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
          const avatar = (first?.authorName ?? '?').slice(0, 1).toUpperCase()
          return (
            <article
              key={thread.id}
              className={cn(
                'group/thread rounded-[10px] border border-border bg-card p-3 text-[13px]',
                active && 'ring-1 ring-primary',
                thread.resolvedAt && 'opacity-60',
              )}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                    {avatar}
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold leading-tight">{first?.authorName ?? 'User'}</p>
                    <button
                      type="button"
                      className="font-mono text-[11px] text-primary hover:underline"
                      onClick={() => onSeek(thread.startOutMs)}
                    >
                      {formatScriptTimecode(thread.startOutMs)}
                      <span className="ml-2 font-sans text-muted-foreground">
                        {first ? formatRelativeTime(first.createdAt) : ''}
                      </span>
                    </button>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="opacity-100 md:opacity-0 md:group-hover/thread:opacity-100 md:group-focus-within/thread:opacity-100"
                        aria-label="Thread actions"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    {first && onEditComment && (
                      <DropdownMenuItem
                        onClick={() => {
                          const next = window.prompt('Edit comment', first.body)
                          if (next?.trim()) void onEditComment(thread.id, first.id, next.trim())
                        }}
                      >
                        Edit
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => {
                        const base = typeof window !== 'undefined' ? window.location.origin : ''
                        const href = `${base}/app/clips/${projectId}/script?comment=${thread.id}`
                        void navigator.clipboard.writeText(href)
                        toast.success('Comment link copied')
                      }}
                    >
                      Copy link
                    </DropdownMenuItem>
                    {onDeleteThread && (
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => void onDeleteThread(thread.id)}
                      >
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {thread.quoteText && (
                <p className="mb-2 border-l-2 border-primary/40 pl-2 text-xs italic text-muted-foreground">
                  {thread.quoteText}
                </p>
              )}
              {first && <p className="mb-1 leading-relaxed">{first.body}</p>}
              {thread.comments.slice(1).map((c) => {
                const replyAvatar = (c.authorName ?? '?').slice(0, 1).toUpperCase()
                return (
                  <div key={c.id} className="mt-2 flex gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                      {replyAvatar}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold leading-tight">
                        {c.authorName}
                        <span className="ml-2 font-normal text-muted-foreground">{formatRelativeTime(c.createdAt)}</span>
                      </p>
                      <p className="text-xs leading-relaxed text-foreground">{c.body}</p>
                    </div>
                  </div>
                )
              })}
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

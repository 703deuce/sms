'use client'

import { useCallback, useEffect, useState } from 'react'
import { clipsFetch } from '@/lib/clips-api'
import type { CommentThreadDto } from '@/lib/server/clips/composition-comments'

export function useCompositionComments(
  compositionId: string,
  opts?: { scope?: 'clip' | 'full'; fullCompositionId?: string | null },
) {
  const [threads, setThreads] = useState<CommentThreadDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const scope = opts?.scope ?? 'clip'
  const fullCompositionId = opts?.fullCompositionId ?? null

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ scope })
      if (fullCompositionId) qs.set('fullCompositionId', fullCompositionId)
      const res = await clipsFetch<{ threads: CommentThreadDto[] }>(
        `/api/clips/compositions/${compositionId}/comments?${qs.toString()}`,
      )
      setThreads(res.threads)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load comments')
    } finally {
      setLoading(false)
    }
  }, [compositionId, scope, fullCompositionId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createThread = useCallback(
    async (input: {
      body: string
      startOutMs: number
      endOutMs: number
      anchorWordStart?: string
      anchorWordEnd?: string
      quoteText?: string
      mentionedUserIds?: string[]
    }) => {
      const res = await clipsFetch<{ thread: CommentThreadDto }>(
        `/api/clips/compositions/${compositionId}/comments`,
        { method: 'POST', body: JSON.stringify(input) },
      )
      setThreads((prev) => [...prev, res.thread].sort((a, b) => a.startOutMs - b.startOutMs))
      return res.thread
    },
    [compositionId],
  )

  const reply = useCallback(
    async (threadId: string, body: string, mentionedUserIds?: string[]) => {
      const res = await clipsFetch<{ thread: CommentThreadDto }>(
        `/api/clips/compositions/${compositionId}/comments/${threadId}`,
        { method: 'POST', body: JSON.stringify({ body, mentionedUserIds }) },
      )
      if (res.thread) {
        setThreads((prev) => prev.map((t) => (t.id === threadId ? res.thread! : t)))
      }
    },
    [compositionId],
  )

  const setResolved = useCallback(
    async (threadId: string, resolved: boolean) => {
      const res = await clipsFetch<{ thread: CommentThreadDto }>(
        `/api/clips/compositions/${compositionId}/comments/${threadId}`,
        { method: 'PATCH', body: JSON.stringify({ resolved }) },
      )
      if (res.thread) {
        setThreads((prev) => prev.map((t) => (t.id === threadId ? res.thread! : t)))
      }
    },
    [compositionId],
  )

  const deleteThread = useCallback(
    async (threadId: string) => {
      await clipsFetch(`/api/clips/compositions/${compositionId}/comments/${threadId}`, { method: 'DELETE' })
      setThreads((prev) => prev.filter((t) => t.id !== threadId))
    },
    [compositionId],
  )

  const editComment = useCallback(
    async (threadId: string, commentId: string, body: string) => {
      const res = await clipsFetch<{ thread: CommentThreadDto }>(
        `/api/clips/compositions/${compositionId}/comments/${threadId}`,
        { method: 'PATCH', body: JSON.stringify({ commentId, body }) },
      )
      if (res.thread) {
        setThreads((prev) => prev.map((t) => (t.id === threadId ? res.thread! : t)))
      }
    },
    [compositionId],
  )

  return {
    threads,
    loading,
    error,
    refresh,
    createThread,
    reply,
    setResolved,
    deleteThread,
    editComment,
  }
}

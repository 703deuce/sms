'use client'

import { useCallback, useEffect, useState } from 'react'
import { clipsFetch } from '@/lib/clips-api'
import type { CommentThreadDto } from '@/lib/server/clips/composition-comments'

export function useCompositionComments(compositionId: string) {
  const [threads, setThreads] = useState<CommentThreadDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await clipsFetch<{ threads: CommentThreadDto[] }>(
        `/api/clips/compositions/${compositionId}/comments`,
      )
      setThreads(res.threads)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load comments')
    } finally {
      setLoading(false)
    }
  }, [compositionId])

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

  return { threads, loading, error, refresh, createThread, reply, setResolved }
}

'use client'

import type { CollabStatus } from '@/components/screenwriting/use-screenplay-yjs-collab'

export function CollabStatusBanner({ status }: { status: CollabStatus }) {
  if (status.mode === 'live') {
    return (
      <p className="rounded border border-green-200 bg-green-50 px-3 py-1 text-xs text-green-900">
        Live collaboration connected (Yjs undo).
      </p>
    )
  }
  if (status.mode === 'connecting') {
    return (
      <p className="rounded border border-muted bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
        {status.reason}
      </p>
    )
  }
  return (
    <p className="rounded border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-950">
      <strong>Local editing.</strong> {status.reason}
    </p>
  )
}

'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { EditorPageSkeleton } from '@/components/clips/editor/editor-page-skeleton'

/** A stalled server payload should never masquerade as endless loading. */
export function MotionStudioEditorLoading({ projectId }: { projectId: string }) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setSlow(true), 15000)
    return () => window.clearTimeout(id)
  }, [])
  return (
    <div className="relative">
      <EditorPageSkeleton />
      {slow ? (
        <div className="absolute inset-x-3 top-20 z-20 mx-auto max-w-xl rounded-xl border border-border bg-card p-5 shadow-lg" role="status">
          <h2 className="text-base font-semibold">Your editor is taking longer than expected</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your finished video is saved. The editing screen is still loading its media.
            You can retry or return to the project without losing your work.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <button type="button" onClick={() => window.location.reload()}
              className="rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground">Retry editor</button>
            <Link href={'/app/motion-studio/' + encodeURIComponent(projectId)}
              className="rounded-md border border-border px-3 py-2 font-medium">Back to video</Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}

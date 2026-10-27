'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { clipsFetch } from '@/lib/clips-api'

type Bootstrap = {
  sourceVideoUrl: string | null
  title: string
}

export function ShareClipViewer({
  title,
  projectId,
  compositionId,
  mode,
  viewCount,
}: {
  title: string
  projectId: string
  compositionId: string
  mode: 'view' | 'comment'
  viewCount?: number
}) {
  const [data, setData] = useState<Bootstrap | null>(null)

  useEffect(() => {
    void clipsFetch<Bootstrap>(`/api/clips/projects/${projectId}/script/bootstrap`)
      .then(setData)
      .catch(() => setData(null))
  }, [projectId])

  return (
    <div className="min-h-dvh bg-background" data-testid="share-clip-viewer">
      <header className="flex h-14 items-center justify-between border-b border-border px-4 md:px-8">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">Transovo share</p>
        </div>
        <div className="flex items-center gap-3">
          {viewCount != null && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="size-4" />
              {viewCount.toLocaleString()} views
            </span>
          )}
          <Button type="button" size="sm" variant="outline" render={<Link href={`/app/clips/${projectId}/script`} />}>
            Edit
          </Button>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-6 p-4 md:grid-cols-[1fr_360px] md:p-8">
        <div className="aspect-video overflow-hidden rounded-xl bg-black">
          {data?.sourceVideoUrl ? (
            <video src={data.sourceVideoUrl} controls className="h-full w-full" playsInline />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading player…</div>
          )}
        </div>
        <aside className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Transcript</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            {mode === 'comment' ? 'Comments are enabled for this link.' : 'View-only share link.'}
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Composition <span className="font-mono">{compositionId.slice(0, 8)}</span>
          </p>
        </aside>
      </main>
      <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        Made with Transovo
      </footer>
    </div>
  )
}

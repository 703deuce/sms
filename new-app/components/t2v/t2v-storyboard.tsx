'use client'

import { useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { PrimaryButton } from '@/components/app/primary-button'
import { Button } from '@/components/ui/button'
import type { T2vDraftV1, T2vScene } from '@/lib/t2v/types'
import { estimateSceneMs } from '@/lib/t2v/estimate'
import { Loader2 } from 'lucide-react'

type Props = {
  draftId: string
  projectId: string
  document: T2vDraftV1
  onDocumentChange?: (doc: T2vDraftV1) => void
}

export function T2vStoryboard({ draftId, projectId, document: initial, onDocumentChange }: Props) {
  const [doc, setDoc] = useState(initial)
  const [matching, setMatching] = useState(false)
  const [building, setBuilding] = useState(false)

  const runMatch = async () => {
    setMatching(true)
    try {
      const res = await fetch(`/api/t2v/drafts/${draftId}/storyboard`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'match_failed')
      const next = (body.data?.document ?? body.data) as T2vDraftV1
      setDoc(next)
      onDocumentChange?.(next)
      toast.success('Storyboard media matched')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not match media')
    } finally {
      setMatching(false)
    }
  }

  const runBuild = async () => {
    setBuilding(true)
    try {
      const res = await fetch(`/api/t2v/drafts/${draftId}/assemble`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'assemble_failed')
      toast.success('Building video…')
      window.location.href = `/app/clips/${projectId}/script`
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start build')
    } finally {
      setBuilding(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Storyboard</h2>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" disabled={matching} onClick={() => void runMatch()}>
            {matching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Match stock
          </Button>
          <PrimaryButton type="button" disabled={building} onClick={() => void runBuild()}>
            {building ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Build video
          </PrimaryButton>
        </div>
      </div>
      <div className="grid flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto lg:grid-cols-3">
        {doc.scenes.map((scene: T2vScene, idx) => (
          <article key={scene.id} className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="relative aspect-video bg-muted">
              {scene.media.thumbUrl ? (
                <Image src={scene.media.thumbUrl} alt="" fill className="object-cover" unoptimized />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No media</div>
              )}
            </div>
            <div className="space-y-1 p-3 text-sm">
              <p className="font-medium">Scene {idx + 1}</p>
              <p className="line-clamp-2 text-muted-foreground">{scene.narration}</p>
              <p className="text-xs text-muted-foreground">{(estimateSceneMs(scene) / 1000).toFixed(1)}s</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

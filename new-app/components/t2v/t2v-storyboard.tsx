'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { toast } from 'sonner'
import { PrimaryButton } from '@/components/app/primary-button'
import { Button } from '@/components/ui/button'
import type { T2vDraftV1, T2vScene } from '@/lib/t2v/types'
import { estimateSceneMs } from '@/lib/t2v/estimate'
import { Loader2, Wand2 } from 'lucide-react'
import { T2vSceneMediaDialog } from '@/components/t2v/t2v-scene-media-dialog'
import { cn } from '@/lib/utils'

type Props = {
  draftId: string
  projectId: string
  document: T2vDraftV1
  revision?: number
  onDocumentChange?: (doc: T2vDraftV1, revision?: number) => void
  onAssembling?: () => void
}

export function T2vStoryboard({ draftId, projectId, document: doc, revision, onDocumentChange, onAssembling }: Props) {
  const [matching, setMatching] = useState(false)
  const [building, setBuilding] = useState(false)
  const [mediaSceneId, setMediaSceneId] = useState<string | null>(null)

  const runMatch = async () => {
    setMatching(true)
    try {
      const res = await fetch(`/api/t2v/drafts/${draftId}/storyboard`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'match_failed')
      const next = (body.data?.document ?? body.data) as T2vDraftV1
      onDocumentChange?.(next, body.data?.revision)
      toast.success('Storyboard media matched')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not match media')
    } finally {
      setMatching(false)
    }
  }

  const runBuild = async () => {
    const fineEdited = doc.scenes.filter((s) => s.fineEditedAt)
    if (fineEdited.length) {
      const ok = window.confirm(
        `${fineEdited.length} scene(s) were edited in the script editor. Rebuilding may replace word-level edits in those scenes. Continue?`,
      )
      if (!ok) return
    }
    setBuilding(true)
    try {
      const res = await fetch(`/api/t2v/drafts/${draftId}/assemble`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'assemble_failed')
      toast.success('Building video…')
      onAssembling?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start build')
    } finally {
      setBuilding(false)
    }
  }

  const staleVoice = (scene: T2vScene) => scene.voice?.status === 'stale'
  const staleCount = doc.scenes.filter(staleVoice).length

  const reVoiceStale = async () => {
    const stale = doc.scenes.filter(staleVoice)
    if (!stale.length) return
    const fine = stale.filter((s) => s.fineEditedAt)
    if (fine.length) {
      const ok = window.confirm(
        `${fine.length} stale scene(s) were fine-edited in the script editor. Re-voicing replaces word edits for those scenes. Continue?`,
      )
      if (!ok) return
    }
    setMatching(true)
    try {
      for (const s of stale) {
        const res = await fetch(`/api/t2v/drafts/${draftId}/scenes/${s.id}/voice`, { method: 'POST' })
        if (!res.ok) throw new Error('re_voice_failed')
      }
      const fresh = await fetch(`/api/t2v/drafts/${draftId}`).then((r) => r.json())
      const next = fresh.data.document as T2vDraftV1
      onDocumentChange?.(next, fresh.data.revision)
      toast.success(`Re-voiced ${stale.length} scene(s)`)
    } catch {
      toast.error('Re-voice failed')
    } finally {
      setMatching(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Storyboard</h2>
        <div className="flex flex-wrap gap-2">
          {staleCount > 0 ? (
            <Button type="button" variant="outline" disabled={matching} onClick={() => void reVoiceStale()}>
              Re-voice {staleCount} scene{staleCount === 1 ? '' : 's'}
            </Button>
          ) : null}
          <Button type="button" variant="secondary" disabled={matching} onClick={() => void runMatch()}>
            {matching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Match stock
          </Button>
          <PrimaryButton type="button" disabled={building || !doc.scenes.length} onClick={() => void runBuild()}>
            {building ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Build video
          </PrimaryButton>
          <Link
            href={`/app/clips/${projectId}/script`}
            className="inline-flex h-8 items-center justify-center rounded-md border border-border px-3 text-sm hover:bg-muted"
          >
            Open in editor
          </Link>
        </div>
      </div>
      {doc.scenes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No scenes yet. Finish script review or ask Chat to add scenes.
        </div>
      ) : (
        <div className="grid flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto lg:grid-cols-3">
          {doc.scenes.map((scene: T2vScene, idx) => (
            <article
              key={scene.id}
              className={cn(
                'overflow-hidden rounded-xl border bg-card',
                staleVoice(scene) ? 'border-amber-500/50' : 'border-border',
              )}
            >
              <div className="relative aspect-video bg-muted">
                {scene.media.thumbUrl ? (
                  <Image src={scene.media.thumbUrl} alt="" fill className="object-cover" unoptimized />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-xs text-muted-foreground">
                    No media
                    <Button type="button" size="sm" variant="secondary" onClick={() => void runMatch()}>Find visuals</Button>
                  </div>
                )}
                {staleVoice(scene) ? (
                  <span className="absolute right-1 top-1 rounded bg-amber-500/90 px-1 text-[10px] text-white">Re-voice</span>
                ) : null}
              </div>
              <div className="space-y-1 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">Scene {idx + 1}</p>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label="Replace media" onClick={() => setMediaSceneId(scene.id)}>
                    <Wand2 className="size-4" />
                  </Button>
                </div>
                <p className="line-clamp-2 text-muted-foreground">{scene.narration}</p>
                <p className="text-xs text-muted-foreground">{(estimateSceneMs(scene) / 1000).toFixed(1)}s</p>
              </div>
            </article>
          ))}
        </div>
      )}
      {mediaSceneId ? (
        <T2vSceneMediaDialog
          open
          draftId={draftId}
          sceneId={mediaSceneId}
          defaultPrompt={doc.scenes.find((s) => s.id === mediaSceneId)?.visualQuery ?? ''}
          onClose={() => setMediaSceneId(null)}
          onQueued={() => {
            void fetch(`/api/t2v/drafts/${draftId}`)
              .then((r) => r.json())
              .then((b) => onDocumentChange?.(b.data.document as T2vDraftV1, b.data.revision))
          }}
        />
      ) : null}
    </div>
  )
}

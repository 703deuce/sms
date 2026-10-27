'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { patchT2vDraft, runT2vScript } from '@/lib/t2v/t2v-api'
import { PrimaryButton } from '@/components/app/primary-button'
import { useRouter } from 'next/navigation'
import type { T2vDraftV1, T2vScene } from '@/lib/t2v/types'
import { estimateSceneMs } from '@/lib/t2v/estimate'
import { createId } from '@/lib/supabase/id'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal } from 'lucide-react'

type Props = {
  draftId: string
  projectId: string
  initialRevision: number
  initialDocument: T2vDraftV1
  draftStatus?: string
}

const REWRITES = ['Shorter', 'Longer', 'More casual', 'More professional', 'Add hook', 'Add CTA'] as const

export function T2vScriptReview({ draftId, projectId, initialRevision, initialDocument, draftStatus }: Props) {
  const router = useRouter()
  const [doc, setDoc] = useState(initialDocument)
  const [revision, setRevision] = useState(initialRevision)
  const [rewriting, setRewriting] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleSave = useCallback(
    (next: T2vDraftV1) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        void patchT2vDraft(draftId, revision, next)
          .then((r) => {
            setRevision(r.revision)
          })
          .catch((e) => {
            if (e instanceof Error && e.message === 'revision_conflict') {
              toast.error('Changed in another tab — reload the page')
            }
          })
      }, 800)
    },
    [draftId, revision],
  )

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
  }, [])

  const commitDoc = (next: T2vDraftV1) => {
    setDoc(next)
    scheduleSave(next)
  }

  const updateScene = (idx: number, patch: Partial<T2vScene>) => {
    const scenes = [...doc.scenes]
    scenes[idx] = { ...scenes[idx], ...patch }
    commitDoc({ ...doc, scenes })
  }

  const duplicateScene = (idx: number) => {
    const src = doc.scenes[idx]
    const slot = doc.nextSlot
    const copy: T2vScene = {
      ...src,
      id: createId('sc'),
      slot,
      voice: src.voice ? { ...src.voice, status: 'stale' } : src.voice,
    }
    const scenes = [...doc.scenes]
    scenes.splice(idx + 1, 0, copy)
    commitDoc({ ...doc, scenes, nextSlot: slot + 1 })
  }

  const deleteScene = (idx: number) => {
    if (doc.scenes.length <= 1) {
      toast.error('Keep at least one scene')
      return
    }
    const scenes = doc.scenes.filter((_, i) => i !== idx)
    commitDoc({ ...doc, scenes })
  }

  const moveScene = (idx: number, delta: number) => {
    const j = idx + delta
    if (j < 0 || j >= doc.scenes.length) return
    const scenes = [...doc.scenes]
    const [row] = scenes.splice(idx, 1)
    scenes.splice(j, 0, row)
    commitDoc({ ...doc, scenes })
  }

  const regenerateScene = (idx: number) => {
    setRewriting(true)
    void runT2vScript(draftId, `Rewrite only scene ${idx + 1} with fresh narration; keep other scenes unchanged.`)
      .then(async () => {
        const d = await fetch(`/api/t2v/drafts/${draftId}`).then((r) => r.json())
        setDoc(d.data.document as T2vDraftV1)
        setRevision(d.data.revision)
        toast.success(`Scene ${idx + 1} regenerated`)
      })
      .catch(() => toast.error('Regenerate failed'))
      .finally(() => setRewriting(false))
  }

  const totalWords = doc.scenes.reduce((n, s) => n + s.narration.trim().split(/\s+/).filter(Boolean).length, 0)

  if (draftStatus === 'GENERATING' || rewriting) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-12">
        <p className="text-center text-sm text-muted-foreground">Writing script…</p>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (doc.scenes.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">No script yet — generate from the create flow or paste narration in Script mode.</p>
        <PrimaryButton type="button" onClick={() => router.push(`/app/clips/${projectId}/video?mode=storyboard`)}>
          Go to storyboard
        </PrimaryButton>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <div className="flex justify-end">
        <PrimaryButton type="button" onClick={() => router.push(`/app/clips/${projectId}/video?mode=storyboard`)}>
          Make storyboard →
        </PrimaryButton>
      </div>
      <Input
        className="border-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
        value={doc.title}
        onChange={(e) => {
          const next = { ...doc, title: e.target.value }
          setDoc(next)
          scheduleSave(next)
        }}
        placeholder="Video title"
      />
      <p className="text-sm text-muted-foreground">
        {doc.scenes.length} scenes · {totalWords} words · voice {doc.voice?.voiceName ?? '—'}
      </p>
      <div className="flex flex-wrap gap-2">
        {REWRITES.map((label) => (
          <button
            key={label}
            type="button"
            className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted"
            onClick={() => {
              setRewriting(true)
              void runT2vScript(draftId, label)
                .then(async () => {
                  const d = await fetch(`/api/t2v/drafts/${draftId}`).then((r) => r.json())
                  setDoc(d.data.document as T2vDraftV1)
                  setRevision(d.data.revision)
                })
                .catch(() => toast.error('Rewrite failed'))
                .finally(() => setRewriting(false))
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="space-y-4">
        {doc.scenes.map((scene, idx) => (
          <div key={scene.id} className="rounded-xl border border-border p-4">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Scene {idx + 1}</span>
              <div className="flex items-center gap-2">
                <span>{(estimateSceneMs(scene) / 1000).toFixed(1)}s est</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Scene actions">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => duplicateScene(idx)}>Duplicate</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => moveScene(idx, -1)} disabled={idx === 0}>Move up</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => moveScene(idx, 1)} disabled={idx === doc.scenes.length - 1}>
                      Move down
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => regenerateScene(idx)}>Regenerate</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => deleteScene(idx)}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <Textarea
              rows={3}
              value={scene.narration}
              onChange={(e) => updateScene(idx, { narration: e.target.value })}
            />
            <Input
              className="mt-2"
              placeholder="On-screen text (optional)"
              value={scene.onScreenText ?? ''}
              onChange={(e) => updateScene(idx, { onScreenText: e.target.value })}
            />
            <Input
              className="mt-2 text-sm"
              value={scene.visualQuery}
              onChange={(e) => updateScene(idx, { visualQuery: e.target.value })}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

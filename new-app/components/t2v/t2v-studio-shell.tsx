'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Undo2, Redo2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PrimaryButton } from '@/components/app/primary-button'
import { T2vBuildProgress } from '@/components/t2v/t2v-build-progress'
import { T2vProducerPanel } from '@/components/t2v/t2v-producer-panel'
import { T2vPanelStory } from '@/components/t2v/t2v-panel-story'
import { T2vPanelVisuals } from '@/components/t2v/t2v-panel-visuals'
import { T2vPanelAudio } from '@/components/t2v/t2v-panel-audio'
import { T2vPanelText } from '@/components/t2v/t2v-panel-text'
import { T2vPanelBrand } from '@/components/t2v/t2v-panel-brand'
import { T2vPanelStyles } from '@/components/t2v/t2v-panel-styles'
import { T2vRail, type T2vRailTab } from '@/components/t2v/t2v-rail'
import { T2vMobileRail } from '@/components/t2v/t2v-mobile-rail'
import { T2vScenePreviewPlayer } from '@/components/t2v/t2v-scene-preview-player'
import { T2vSceneStrip } from '@/components/t2v/t2v-scene-strip'
import { useT2vDraftPoll } from '@/lib/t2v/use-t2v-draft-poll'
import { useT2vUndo } from '@/lib/t2v/use-t2v-undo'
import { patchT2vDraft } from '@/lib/t2v/t2v-api'
import type { T2vDraftV1, T2vScene } from '@/lib/t2v/types'

export function T2vStudioShell({
  draftId,
  projectId,
  initialDocument,
  initialRevision,
  initialStatus,
  initialStage,
  initialProgress,
  initialError,
  builtVideoUrl,
}: {
  draftId: string
  projectId: string
  initialDocument: T2vDraftV1
  initialRevision: number
  initialStatus: string
  initialStage: string | null
  initialProgress: number
  initialError: string | null
  builtVideoUrl?: string | null
}) {
  const { doc, push, replace, undo, redo, canUndo, canRedo } = useT2vUndo(draftId, initialDocument)
  const [revision, setRevision] = useState(initialRevision)
  const [tab, setTab] = useState<T2vRailTab>('story')
  const [selectedId, setSelectedId] = useState<string | null>(initialDocument.scenes[0]?.id ?? null)
  const [status, setStatus] = useState(initialStatus)
  const [stage, setStage] = useState(initialStage)
  const [progress, setProgress] = useState(initialProgress)
  const [error, setError] = useState(initialError)
  const [matching, setMatching] = useState(false)
  const [building, setBuilding] = useState(false)
  const revisionRef = useRef(initialRevision)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    revisionRef.current = revision
  }, [revision])

  useEffect(() => {
    if (selectedId && doc.scenes.some((s) => s.id === selectedId)) return
    setSelectedId(doc.scenes[0]?.id ?? null)
  }, [doc.scenes, selectedId])

  const onPoll = useCallback(
    (d: { status: string; stage: string | null; progress: number; error: string | null }) => {
      setStatus(d.status)
      setStage(d.stage)
      setProgress(d.progress)
      setError(d.error)
      if (d.status === 'READY' && status === 'ASSEMBLING') {
        void fetch(`/api/t2v/drafts/${draftId}`)
          .then((r) => r.json())
          .then((b) => {
            if (b.data?.document) replace(b.data.document as T2vDraftV1)
            if (b.data?.revision) setRevision(b.data.revision)
          })
      }
    },
    [draftId, replace, status],
  )

  useT2vDraftPoll(draftId, status === 'ASSEMBLING' || stage === 'failed', onPoll)

  const refreshDraft = useCallback(async () => {
    const b = await fetch(`/api/t2v/drafts/${draftId}`).then((r) => r.json())
    if (b.data?.document) replace(b.data.document as T2vDraftV1)
    if (b.data?.revision) {
      setRevision(b.data.revision)
      revisionRef.current = b.data.revision
    }
  }, [draftId, replace])

  const persist = useCallback(
    (next: T2vDraftV1) => {
      push(next)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        void (async () => {
          try {
            const r = await patchT2vDraft(draftId, revisionRef.current, next)
            revisionRef.current = r.revision
            setRevision(r.revision)
          } catch (e) {
            if (e instanceof Error && e.message === 'revision_conflict') {
              toast.error('Draft changed elsewhere — reloaded latest version')
              await refreshDraft()
            } else {
              toast.error('Could not save')
            }
          }
        })()
      }, 400)
    },
    [draftId, push, refreshDraft],
  )

  const cancelBuild = async () => {
    const res = await fetch(`/api/t2v/drafts/${draftId}/assemble/cancel`, { method: 'POST' })
    if (!res.ok) {
      toast.error('Could not cancel build')
      return
    }
    setStatus('DRAFT')
    setStage('canceled')
    setProgress(0)
    setError(null)
  }

  const staleVoice = (scene: T2vScene) => scene.voice?.status === 'stale'

  const runMatch = async () => {
    setMatching(true)
    try {
      const res = await fetch(`/api/t2v/drafts/${draftId}/storyboard`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'match_failed')
      const next = (body.data?.document ?? body.data) as T2vDraftV1
      push(next)
      if (body.data?.revision) setRevision(body.data.revision)
      toast.success('Storyboard media matched')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not match media')
    } finally {
      setMatching(false)
    }
  }

  const runBuild = async () => {
    const fineEdited = doc.scenes.filter((s) => s.fineEditedAt)
    if (fineEdited.length && !window.confirm(`${fineEdited.length} fine-edited scene(s) may change on rebuild. Continue?`)) return
    setBuilding(true)
    try {
      const res = await fetch(`/api/t2v/drafts/${draftId}/assemble`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'assemble_failed')
      setStatus('ASSEMBLING')
      toast.success('Building video…')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start build')
    } finally {
      setBuilding(false)
    }
  }

  const reVoiceStale = async () => {
    const stale = doc.scenes.filter(staleVoice)
    if (!stale.length) return
    setMatching(true)
    const failed: string[] = []
    try {
      for (const s of stale) {
        const res = await fetch(`/api/t2v/drafts/${draftId}/scenes/${s.id}/voice`, { method: 'POST' })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          failed.push(body.error ? String(body.error) : s.id)
        }
      }
      await refreshDraft()
      const ok = stale.length - failed.length
      if (ok && failed.length) {
        toast.warning(`Re-voiced ${ok} scene(s); ${failed.length} failed`)
      } else if (failed.length) {
        toast.error(`Re-voice failed for ${failed.length} scene(s)`)
      } else {
        toast.success(`Re-voiced ${stale.length} scene(s)`)
      }
    } catch {
      toast.error('Re-voice failed')
    } finally {
      setMatching(false)
    }
  }

  const reorder = (from: number, to: number) => {
    const scenes = [...doc.scenes]
    const [moved] = scenes.splice(from, 1)
    scenes.splice(to, 0, moved)
    void persist({ ...doc, scenes })
  }

  const selectAdjacentScene = (delta: number) => {
    if (!selectedId) return
    const i = doc.scenes.findIndex((s) => s.id === selectedId)
    const next = doc.scenes[i + delta]
    if (next) setSelectedId(next.id)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        void runBuild()
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        selectAdjacentScene(-1)
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        selectAdjacentScene(1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, doc, selectedId])

  const panelTitle =
    tab === 'story'
      ? 'Story'
      : tab === 'visuals'
        ? 'Visuals'
        : tab === 'audio'
          ? 'Audio'
          : tab === 'text'
            ? 'Text'
            : tab === 'styles'
              ? 'Styles'
              : tab === 'brand'
                ? 'Brand'
                : 'Chat'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Button type="button" size="icon-sm" variant="ghost" disabled={!canUndo} onClick={undo} aria-label="Undo">
          <Undo2 className="size-4" />
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" disabled={!canRedo} onClick={redo} aria-label="Redo">
          <Redo2 className="size-4" />
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          {doc.scenes.some(staleVoice) ? (
            <Button type="button" size="sm" variant="outline" disabled={matching} onClick={() => void reVoiceStale()}>
              Re-voice stale
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="secondary" disabled={matching} onClick={() => void runMatch()}>
            {matching ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Match stock
          </Button>
          <PrimaryButton type="button" size="sm" disabled={building || !doc.scenes.length} onClick={() => void runBuild()}>
            {building ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Build video
          </PrimaryButton>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative order-1 flex min-h-[240px] flex-1 lg:order-2 lg:min-h-0">
          <T2vScenePreviewPlayer
            draftId={draftId}
            doc={doc}
            sceneId={selectedId}
            builtVideoUrl={builtVideoUrl}
            aspect={doc.settings.aspect}
            onSelectScene={setSelectedId}
          />
          {status === 'ASSEMBLING' || (status === 'DRAFT' && stage === 'failed') ? (
            <T2vBuildProgress
              progress={progress}
              stage={stage}
              error={error}
              onCancel={() => void cancelBuild()}
              onRetry={() => void runBuild()}
            />
          ) : null}
        </div>
        <div className="order-2 flex min-h-0 max-h-[55vh] flex-col lg:order-1 lg:max-h-none lg:max-w-[55%] lg:flex-1">
          <div className="flex min-h-0 flex-1">
            <div className="hidden lg:block">
              <T2vRail active={tab} onSelect={setTab} />
            </div>
            <div className="flex w-full min-w-0 flex-col border-r border-border lg:max-w-[400px]">
              <header className="flex h-12 shrink-0 items-center border-b border-border px-4 text-sm font-medium">{panelTitle}</header>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {tab === 'story' ? (
                  <T2vPanelStory doc={doc} sceneId={selectedId} onChange={(n) => void persist(n)} />
                ) : tab === 'visuals' ? (
                  <T2vPanelVisuals draftId={draftId} doc={doc} sceneId={selectedId} onRefresh={() => void refreshDraft()} />
                ) : tab === 'audio' ? (
                  <T2vPanelAudio draftId={draftId} doc={doc} onChange={(n) => void persist(n)} />
                ) : tab === 'text' ? (
                  <T2vPanelText doc={doc} onChange={(n) => void persist(n)} />
                ) : tab === 'styles' ? (
                  <T2vPanelStyles
                    draftId={draftId}
                    doc={doc}
                    onChange={(n) => void persist(n)}
                    onTemplateApplied={(d, rev) => {
                      push(d)
                      setRevision(rev)
                    }}
                  />
                ) : tab === 'brand' ? (
                  <T2vPanelBrand doc={doc} onChange={(n) => void persist(n)} />
                ) : (
                  <div className="p-3">
                    <T2vProducerPanel
                      draftId={draftId}
                      onDocument={(d, rev) => {
                        push(d)
                        setRevision(rev)
                        revisionRef.current = rev
                      }}
                      onAssembling={() => {
                        setStatus('ASSEMBLING')
                        setProgress(0)
                        setError(null)
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          <T2vSceneStrip scenes={doc.scenes} selectedId={selectedId} onSelect={setSelectedId} onReorder={reorder} />
          <T2vMobileRail active={tab} onSelect={setTab} />
        </div>
      </div>
    </div>
  )
}

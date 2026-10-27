'use client'

import type { ReactNode } from 'react'
import { useCallback, useState } from 'react'
import { MessageSquare, Mic, Type, Film, Undo2, Redo2, Music, Palette, LayoutTemplate, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { T2vBuildProgress } from '@/components/t2v/t2v-build-progress'
import { T2vProducerPanel } from '@/components/t2v/t2v-producer-panel'
import { T2vPanelCaptions } from '@/components/t2v/t2v-panel-captions'
import { T2vPanelVoice } from '@/components/t2v/t2v-panel-voice'
import { T2vPanelMusic } from '@/components/t2v/t2v-panel-music'
import { T2vPanelText } from '@/components/t2v/t2v-panel-text'
import { T2vPanelBrand } from '@/components/t2v/t2v-panel-brand'
import { T2vPanelTemplates } from '@/components/t2v/t2v-panel-templates'
import { useT2vDraftPoll } from '@/lib/t2v/use-t2v-draft-poll'
import { useT2vUndo } from '@/lib/t2v/use-t2v-undo'
import { patchT2vDraft } from '@/lib/t2v/t2v-api'
import type { T2vDraftV1 } from '@/lib/t2v/types'
import { cn } from '@/lib/utils'

type Tab = 'story' | 'voice' | 'music' | 'captions' | 'text' | 'brand' | 'templates' | 'chat'

export function T2vStudioShell({
  draftId,
  initialDocument,
  initialRevision,
  initialStatus,
  initialStage,
  initialProgress,
  initialError,
  children,
}: {
  draftId: string
  initialDocument: T2vDraftV1
  initialRevision: number
  initialStatus: string
  initialStage: string | null
  initialProgress: number
  initialError: string | null
  children: (ctx: {
    doc: T2vDraftV1
    setDoc: (d: T2vDraftV1) => void
    revision: number
    setRevision: (n: number) => void
    pushHistory: (d: T2vDraftV1) => void
  }) => ReactNode
}) {
  const { doc, push, replace, undo, redo, canUndo, canRedo } = useT2vUndo(initialDocument)
  const [revision, setRevision] = useState(initialRevision)
  const [tab, setTab] = useState<Tab>('story')
  const [status, setStatus] = useState(initialStatus)
  const [stage, setStage] = useState(initialStage)
  const [progress, setProgress] = useState(initialProgress)
  const [error, setError] = useState(initialError)

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

  useT2vDraftPoll(draftId, status === 'ASSEMBLING', onPoll)

  const persist = async (next: T2vDraftV1) => {
    push(next)
    try {
      const r = await patchT2vDraft(draftId, revision, next)
      setRevision(r.revision)
    } catch {
      /* conflict handled in child */
    }
  }

  const cancelBuild = async () => {
    await fetch(`/api/t2v/drafts/${draftId}/assemble/cancel`, { method: 'POST' })
    setStatus('DRAFT')
    setProgress(0)
    setError(null)
  }

  const tabs: { id: Tab; label: string; icon: typeof Film }[] = [
    { id: 'story', label: 'Story', icon: Film },
    { id: 'voice', label: 'Voice', icon: Mic },
    { id: 'music', label: 'Music', icon: Music },
    { id: 'captions', label: 'Captions', icon: Type },
    { id: 'text', label: 'Text', icon: FileText },
    { id: 'brand', label: 'Brand', icon: Palette },
    { id: 'templates', label: 'Template', icon: LayoutTemplate },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
  ]

  return (
    <div className="flex min-h-0 flex-1">
      <nav className="flex w-14 shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-border py-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            title={t.label}
            className={cn(
              'flex size-10 items-center justify-center rounded-lg',
              tab === t.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60',
            )}
            onClick={() => setTab(t.id)}
          >
            <t.icon className="size-4" aria-hidden />
          </button>
        ))}
      </nav>
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1 border-b border-border px-2 py-1">
          <Button type="button" size="icon-sm" variant="ghost" disabled={!canUndo} onClick={undo} aria-label="Undo">
            <Undo2 className="size-4" />
          </Button>
          <Button type="button" size="icon-sm" variant="ghost" disabled={!canRedo} onClick={redo} aria-label="Redo">
            <Redo2 className="size-4" />
          </Button>
        </div>
        <div className="relative flex min-h-0 flex-1">
          {tab === 'story' ? (
            children({
              doc,
              setDoc: replace,
              revision,
              setRevision,
              pushHistory: push,
            })
          ) : tab === 'voice' ? (
            <T2vPanelVoice doc={doc} onChange={(n) => void persist(n)} />
          ) : tab === 'music' ? (
            <T2vPanelMusic doc={doc} onChange={(n) => void persist(n)} />
          ) : tab === 'captions' ? (
            <T2vPanelCaptions doc={doc} onChange={(n) => void persist(n)} />
          ) : tab === 'text' ? (
            <T2vPanelText doc={doc} onChange={(n) => void persist(n)} />
          ) : tab === 'brand' ? (
            <T2vPanelBrand doc={doc} onChange={(n) => void persist(n)} />
          ) : tab === 'templates' ? (
            <T2vPanelTemplates
              draftId={draftId}
              onApplied={(d, rev) => {
                replace(d)
                setRevision(rev)
              }}
            />
          ) : (
            <div className="flex min-h-0 flex-1 p-3">
              <T2vProducerPanel
                draftId={draftId}
                onDocument={(d, rev) => {
                  replace(d)
                  setRevision(rev)
                }}
              />
            </div>
          )}
          {status === 'ASSEMBLING' ? (
            <T2vBuildProgress
              progress={progress}
              stage={stage}
              error={error}
              onCancel={() => void cancelBuild()}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

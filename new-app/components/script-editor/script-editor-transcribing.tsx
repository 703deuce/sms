'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Panel } from '@/components/app/page-primitives'
import { Button } from '@/components/ui/button'
import { clipsFetch, getProjectStatus } from '@/lib/clips-api'
import type { ScriptBootstrapView } from '@/components/script-editor/script-editor-shell'

export function ScriptEditorTranscribing({
  projectId,
  initialStatus,
  clipId,
  onReady,
}: {
  projectId: string
  initialStatus: string
  clipId?: string | null
  onReady: (data: ScriptBootstrapView) => void
}) {
  const [stage, setStage] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const st = await getProjectStatus(projectId)
        if (cancelled) return
        setStage(st.stage)
        setProgress(st.progress)
        if (st.status === 'FAILED' || st.status === 'CANCELED') {
          setError(st.error || `Project ${st.status.toLowerCase()}`)
          return
        }
        if (st.status === 'READY' || st.wordCount > 0) {
          const qs = clipId ? `?clipId=${encodeURIComponent(clipId)}` : ''
          const data = await clipsFetch<ScriptBootstrapView>(`/api/clips/projects/${projectId}/script/bootstrap${qs}`)
          if (!cancelled && data.editorWords.length > 0) {
            console.info('[editor:transcribe]', 'ready', { projectId, wordCount: data.wordCount })
            onReady(data)
            return
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Status check failed')
        return
      }
      if (!cancelled) window.setTimeout(() => void poll(), 2500)
    }
    console.info('[editor:transcribe]', 'polling', { projectId, initialStatus })
    void poll()
    return () => {
      cancelled = true
    }
  }, [projectId, clipId, initialStatus, onReady])

  if (error) {
    return (
      <Panel title="Transcription failed" description={error}>
        <Button type="button" size="sm" variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </Panel>
    )
  }

  return (
    <Panel
      title="Transcribing your media…"
      description="This usually takes a few minutes. The editor will open automatically when the transcript is ready."
    >
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        <span>
          {stage ? `${stage} · ` : ''}
          {progress > 0 ? `${progress}%` : 'Starting…'}
        </span>
      </div>
    </Panel>
  )
}

'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Panel } from '@/components/app/page-primitives'
import { Button } from '@/components/ui/button'
import { ScriptEmptyImport } from '@/components/script-editor/import/script-empty-import'
import { ScriptEditorShell, type ScriptBootstrapView } from '@/components/script-editor/script-editor-shell'
import { ScriptEditorTranscribing } from '@/components/script-editor/script-editor-transcribing'
import { clipsFetch } from '@/lib/clips-api'
import { isClipProjectProcessing } from '@/lib/clips/project-processing'

export function ScriptEditorEntry({
  projectId,
  projectTitle,
  clipId,
}: {
  projectId: string
  projectTitle: string
  clipId?: string | null
}) {
  const [data, setData] = useState<ScriptBootstrapView | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadBootstrap = useCallback(async () => {
    const qs = clipId ? `?clipId=${encodeURIComponent(clipId)}` : ''
    return clipsFetch<ScriptBootstrapView>(`/api/clips/projects/${projectId}/script/bootstrap${qs}`)
  }, [projectId, clipId])

  useEffect(() => {
    void loadBootstrap()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [loadBootstrap])

  if (error) {
    return (
      <Panel title="Could not load script" description={error}>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button className="mt-3" size="sm" render={<Link href={`/app/clips/${projectId}`} />}>
          Back to project
        </Button>
      </Panel>
    )
  }

  if (!data) {
    return (
      <Panel title="Loading script editor…" description="Fetching transcript and source media.">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Panel>
    )
  }

  if (!data.editorWords.length) {
    if (data.status === 'FAILED' || data.status === 'CANCELED') {
      return (
        <Panel title="Could not open editor" description="Transcription did not complete successfully.">
          <Button className="mt-3" size="sm" render={<Link href={`/app/clips/${projectId}`} />}>
            Back to project
          </Button>
        </Panel>
      )
    }
    if (isClipProjectProcessing(data.status)) {
      return (
        <ScriptEditorTranscribing
          projectId={projectId}
          initialStatus={data.status}
          clipId={clipId}
          onReady={setData}
        />
      )
    }
    return <ScriptEmptyImport projectId={projectId} projectTitle={projectTitle} />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ScriptEditorShell data={data} />
    </div>
  )
}

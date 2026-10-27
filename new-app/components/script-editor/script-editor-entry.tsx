'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Panel } from '@/components/app/page-primitives'
import { Button } from '@/components/ui/button'
import { ScriptEditorShell, type ScriptBootstrapView } from '@/components/script-editor/script-editor-shell'
import { clipsFetch } from '@/lib/clips-api'

export function ScriptEditorEntry({ projectId }: { projectId: string; projectTitle: string }) {
  const [data, setData] = useState<ScriptBootstrapView | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void clipsFetch<ScriptBootstrapView>(`/api/clips/projects/${projectId}/script/bootstrap`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [projectId])

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
    return (
      <Panel title="No transcript yet" description="Process this project to generate words before editing the script.">
        <Button size="sm" render={<Link href={`/app/clips/${projectId}`} />}>
          Back to project
        </Button>
      </Panel>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ScriptEditorShell data={data} />
    </div>
  )
}

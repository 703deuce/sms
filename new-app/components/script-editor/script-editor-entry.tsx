'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Panel } from '@/components/app/page-primitives'
import { Button } from '@/components/ui/button'
import { ScriptEditorShell, type ScriptBootstrapView } from '@/components/script-editor/script-editor-shell'
import { clipsFetch } from '@/lib/clips-api'
import { Film } from 'lucide-react'

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
    <div className="flex flex-col gap-4">
      <ScriptEditorShell data={data} />
      {data.clips.length > 0 ? (
        <Panel
          title="Cut by transcript"
          description="Delete words in the clip editor to trim video (full-project editing ships in M2)."
        >
          <ul className="flex flex-wrap gap-2">
            {data.clips.slice(0, 6).map((c) => (
              <li key={c.id}>
                <Button size="sm" variant="outline" render={<Link href={`/app/clips/${projectId}/edit/${c.id}`} />}>
                  <Film className="size-4" aria-hidden />
                  {c.title}
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  )
}

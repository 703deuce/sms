'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { PageHeader, Panel } from '@/components/app/page-primitives'
import { Button } from '@/components/ui/button'
import { clipsFetch } from '@/lib/clips-api'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import { Film, Pencil } from 'lucide-react'

type Bootstrap = {
  projectId: string
  title: string
  wordCount: number
  sourceVideoUrl: string | null
  editorWords: EditorWord[]
  clips: { id: string; title: string }[]
  status: string
}

function groupParagraphs(words: EditorWord[], maxGapMs = 1200) {
  const paras: EditorWord[][] = []
  let cur: EditorWord[] = []
  for (const w of words) {
    if (cur.length && w.t0Ms - cur[cur.length - 1].t1Ms > maxGapMs) {
      paras.push(cur)
      cur = []
    }
    cur.push(w)
  }
  if (cur.length) paras.push(cur)
  return paras
}

export function ScriptEditorEntry({ projectId, projectTitle }: { projectId: string; projectTitle: string }) {
  const [data, setData] = useState<Bootstrap | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void clipsFetch<Bootstrap>(`/api/clips/projects/${projectId}/script/bootstrap`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [projectId])

  const paragraphs = useMemo(() => (data ? groupParagraphs(data.editorWords) : []), [data])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Pencil}
        title={projectTitle}
        description="Script editor — read-only transcript sync (M1). Cut and export per clip via Edit clip."
      />
      {error ? (
        <Panel title="Could not load script" description={error}>
          <p className="text-sm text-muted-foreground">{error}</p>
        </Panel>
      ) : !data ? (
        <Panel title="Loading transcript…" description="Fetching project words and source.">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </Panel>
      ) : (
        <>
          <Panel
            title={`${data.wordCount} words`}
            description={
              data.status === 'READY'
                ? 'Open a clip to delete words and cut the video (existing editor).'
                : `Project status: ${data.status}`
            }
            actions={
              data.clips[0] ? (
                <Button size="sm" render={<Link href={`/app/clips/${projectId}/edit/${data.clips[0].id}`} />}>
                  Edit top clip
                </Button>
              ) : null
            }
          >
            {data.sourceVideoUrl ? (
              <video
                className="mb-4 max-h-[40vh] w-full rounded-lg border border-border bg-black"
                src={data.sourceVideoUrl}
                controls
                preload="metadata"
                playsInline
              />
            ) : null}
            <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-border bg-card p-4 text-sm leading-relaxed">
              {paragraphs.map((para, i) => (
                <p key={i} className="mb-3 last:mb-0">
                  {para.map((w) => (
                    <span key={w.id} className={w.isFiller ? 'text-muted-foreground line-through' : undefined}>
                      {w.text}{' '}
                    </span>
                  ))}
                </p>
              ))}
            </div>
          </Panel>
          {data.clips.length > 1 ? (
            <Panel title="Clips" description="Descript-style full-project editing lands in M2; use clip editor today.">
              <ul className="flex flex-col gap-2">
                {data.clips.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/app/clips/${projectId}/edit/${c.id}`}
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Film className="size-4" aria-hidden />
                      {c.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </>
      )}
    </div>
  )
}

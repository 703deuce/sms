'use client'

import type { JSONContent } from '@tiptap/core'
import { scenesFromPmJson } from '@/lib/screenwriting/structure/navigator'

export type BeatBoardState = {
  acts: { id: string; title: string; beatIds: string[] }[]
  beats: { id: string; title: string; body: string; sceneId?: string }[]
}

const defaultBoard = (doc: JSONContent): BeatBoardState => {
  const scenes = scenesFromPmJson(doc)
  return {
    acts: [{ id: 'act1', title: 'Act I', beatIds: scenes.map((s) => `beat-${s.id}`) }],
    beats: scenes.map((s) => ({
      id: `beat-${s.id}`,
      title: s.heading || '(scene)',
      body: s.synopsis || '',
      sceneId: s.id,
    })),
  }
}

export function BeatBoardPanel({
  doc,
  board,
  onChange,
}: {
  doc: JSONContent
  board?: BeatBoardState
  onChange: (b: BeatBoardState) => void
}) {
  const state = board ?? defaultBoard(doc)
  const act = state.acts[0]
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase text-muted-foreground">Acts / sequences</p>
      <div className="grid gap-2 md:grid-cols-3">
        {state.acts.map((a) => (
          <div key={a.id} className="rounded border bg-muted/30 p-2">
            <input
              className="mb-2 w-full rounded border bg-background px-1 text-xs font-semibold"
              value={a.title}
              onChange={(e) => {
                const acts = state.acts.map((x) => (x.id === a.id ? { ...x, title: e.target.value } : x))
                onChange({ ...state, acts })
              }}
            />
            <ul className="space-y-1">
              {a.beatIds.map((bid) => {
                const beat = state.beats.find((b) => b.id === bid)
                if (!beat) return null
                return (
                  <li
                    key={bid}
                    draggable
                    onDragStart={(ev) => ev.dataTransfer.setData('text/beat-id', bid)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(ev) => {
                      ev.preventDefault()
                      const from = ev.dataTransfer.getData('text/beat-id')
                      if (!from || from === bid) return
                      const ids = [...a.beatIds]
                      const fi = ids.indexOf(from)
                      const ti = ids.indexOf(bid)
                      if (fi < 0 || ti < 0) return
                      ids.splice(fi, 1)
                      ids.splice(ti, 0, from)
                      onChange({
                        ...state,
                        acts: state.acts.map((x) => (x.id === a.id ? { ...x, beatIds: ids } : x)),
                      })
                    }}
                    className="cursor-grab rounded border bg-card p-2 text-left shadow-sm"
                  >
                    <p className="font-medium">{beat.title}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-2">{beat.body || '—'}</p>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
      {act && !act.beatIds.length ? <p className="text-muted-foreground">Add scene headings to populate beats.</p> : null}
    </div>
  )
}

'use client'

import type { JSONContent } from '@tiptap/core'
import { scenesFromPmJson } from '@/lib/screenwriting/structure/navigator'
import { reorderScenesInDoc } from '@/lib/screenwriting/structure/scene-reorder'
import { setSceneSynopsis } from '@/lib/screenwriting/structure/scene-synopsis'

export function SceneCardsPanel({
  doc,
  onDocChange,
}: {
  doc: JSONContent
  onDocChange: (d: JSONContent) => void
}) {
  const scenes = scenesFromPmJson(doc)
  return (
    <ul className="space-y-2">
      {scenes.map((s, i) => (
        <li
          key={s.id}
          draggable
          onDragStart={(e) => e.dataTransfer.setData('text/scene-ord', String(i))}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const from = Number(e.dataTransfer.getData('text/scene-ord'))
            if (Number.isNaN(from) || from === i) return
            onDocChange(reorderScenesInDoc(doc, from, i))
          }}
          className="cursor-grab rounded border bg-card p-2 shadow-sm"
        >
          <strong className="text-xs">{s.heading || '(scene)'}</strong>
          <textarea
            className="mt-1 w-full min-h-[48px] rounded border px-1 text-[11px]"
            placeholder="Synopsis"
            value={s.synopsis || ''}
            onChange={(e) => onDocChange(setSceneSynopsis(doc, s.id, e.target.value))}
          />
        </li>
      ))}
    </ul>
  )
}

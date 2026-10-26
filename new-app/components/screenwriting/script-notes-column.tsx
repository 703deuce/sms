'use client'

import { Button } from '@/components/ui/button'

export type ScriptNoteThread = {
  id: string
  elementId: string
  anchorFrom: string
  anchorTo: string
  status?: string
  comments?: { body: string; authorName?: string; createdAt?: string }[]
}

const NOTE_COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626']

export function ScriptNotesColumn({
  open,
  onToggle,
  threads,
  selectedId,
  onSelect,
  onJumpToElement,
}: {
  open: boolean
  onToggle: () => void
  threads: ScriptNoteThread[]
  selectedId: string | null
  onSelect: (id: string) => void
  onJumpToElement: (elementId: string) => void
}) {
  if (!open) {
    return (
      <div className="sw-fd-notes-collapsed flex items-start border-l">
        <Button size="sm" variant="ghost" className="h-full rounded-none px-2 text-[10px] writing-vertical" onClick={onToggle}>
          ScriptNotes
        </Button>
      </div>
    )
  }
  return (
    <aside className="sw-fd-notes flex w-[280px] shrink-0 flex-col border-l bg-card text-xs">
      <div className="flex items-center justify-between border-b px-2 py-1">
        <span className="font-semibold">ScriptNotes</span>
        <Button size="sm" variant="ghost" onClick={onToggle}>×</Button>
      </div>
      <ul className="flex-1 overflow-auto p-2 space-y-2">
        {!threads.length ? <li className="text-muted-foreground">No notes — select text and add a comment.</li> : null}
        {threads.map((t, i) => {
          const body = t.comments?.[0]?.body ?? ''
          const color = NOTE_COLORS[i % NOTE_COLORS.length]
          return (
            <li key={t.id}>
              <button
                type="button"
                className={`w-full rounded border p-2 text-left ${selectedId === t.id ? 'border-primary' : ''}`}
                style={{ borderLeftWidth: 4, borderLeftColor: color }}
                onClick={() => {
                  onSelect(t.id)
                  onJumpToElement(t.elementId)
                }}
              >
                <span className="text-[10px] text-muted-foreground">{t.comments?.[0]?.authorName ?? 'Note'}</span>
                <p className="line-clamp-3">{body}</p>
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}

export function ScriptNoteMarginMarkers({
  threads,
  onSelect,
}: {
  threads: ScriptNoteThread[]
  onSelect: (id: string) => void
}) {
  return (
    <div className="sw-scriptnote-rail pointer-events-none absolute inset-y-0 right-0 w-6" aria-hidden>
      {threads.map((t, i) => (
        <button
          key={t.id}
          type="button"
          className="sw-scriptnote-marker pointer-events-auto absolute right-0 h-3 w-3 rounded-sm"
          style={{
            background: NOTE_COLORS[i % NOTE_COLORS.length],
            top: `calc(var(--marker-top-${t.elementId}, 0px))`,
          }}
          title={t.comments?.[0]?.body?.slice(0, 80)}
          onClick={() => onSelect(t.id)}
        />
      ))}
    </div>
  )
}

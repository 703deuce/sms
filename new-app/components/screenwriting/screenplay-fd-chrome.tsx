'use client'

import type { ReactNode } from 'react'

const MENUS = ['File', 'Edit', 'Format', 'Document', 'Production', 'Tools', 'Window', 'Help']

export function ScreenplayFdChrome({
  mode,
  setMode,
  menuExtra,
  toolbar,
  elementBar,
  navigator,
  editor,
  notes,
  statusBar,
}: {
  mode: 'script' | 'cards' | 'beat'
  setMode: (m: 'script' | 'cards' | 'beat') => void
  menuExtra?: ReactNode
  toolbar: ReactNode
  elementBar: ReactNode
  navigator: ReactNode
  editor: ReactNode
  notes: ReactNode
  statusBar: ReactNode
}) {
  return (
    <div className="sw-fd-shell flex min-h-[70vh] flex-col gap-0 rounded-lg border bg-background">
      <nav className="sw-fd-menubar flex flex-wrap items-center gap-1 border-b px-2 py-1 text-xs">
        {MENUS.map((m) => (
          <button key={m} type="button" className="rounded px-2 py-0.5 hover:bg-muted">
            {m}
          </button>
        ))}
        <span className="ml-auto">{menuExtra}</span>
      </nav>
      <div className="sw-fd-toolbar border-b px-2 py-1">{toolbar}</div>
      <div className="sw-fd-element-bar flex flex-wrap items-center gap-2 border-b px-2 py-1">{elementBar}</div>
      <div className="flex gap-1 border-b px-2 py-1 text-xs">
        {(['script', 'cards', 'beat'] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`rounded px-3 py-1 capitalize ${mode === m ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            onClick={() => setMode(m)}
          >
            {m === 'beat' ? 'Beat Board' : m === 'cards' ? 'Cards' : 'Script'}
          </button>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-1 gap-0 lg:grid-cols-[220px_1fr_260px]">
        <aside className="sw-fd-navigator hidden max-h-[calc(100vh-16rem)] overflow-auto border-r p-2 text-xs lg:block">
          {navigator}
        </aside>
        <main className="sw-fd-page min-h-[60vh] overflow-auto p-2">{editor}</main>
        <aside className="sw-fd-notes hidden max-h-[calc(100vh-16rem)] overflow-auto border-l p-2 text-xs lg:block">
          {notes}
        </aside>
      </div>
      {statusBar}
    </div>
  )
}

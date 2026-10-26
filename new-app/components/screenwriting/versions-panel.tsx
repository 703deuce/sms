'use client'

import { useState } from 'react'
import type { JSONContent } from '@tiptap/core'
import { Button } from '@/components/ui/button'
import { scenesFromPmJson } from '@/lib/screenwriting/structure/navigator'

type VersionRow = {
  id: string
  label?: string | null
  kind?: string
  createdAt: string
  pmJson?: JSONContent
}

export function VersionsPanel({
  scriptId,
  versions,
  currentDoc,
  onRefresh,
  onRestore,
}: {
  scriptId: string
  versions: VersionRow[]
  currentDoc: JSONContent
  onRefresh: () => void
  onRestore: (id: string) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [diffHtml, setDiffHtml] = useState<string | null>(null)
  const [labelEdit, setLabelEdit] = useState('')

  const selectedRow = versions.find((v) => v.id === selected)

  const loadDiff = async (versionId: string) => {
    const res = await fetch(`/api/sw/scripts/${scriptId}/compare?a=${versionId}&b=current`)
    if (!res.ok) return
    const j = await res.json()
    const lines = (j.data?.html as { diff: string }[])?.map((r) => r.diff).join('<br/>') ?? ''
    setDiffHtml(lines || 'No diff')
  }

  const saveLabel = async () => {
    if (!selected || !labelEdit.trim()) return
    await fetch(`/api/sw/versions/${selected}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: labelEdit.trim() }),
    })
    onRefresh()
  }

  return (
    <div className="space-y-2">
      <Button size="sm" onClick={onRefresh}>Refresh</Button>
      <ul className="max-h-40 space-y-1 overflow-auto">
        {versions.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              className={`w-full text-left rounded border px-2 py-1 ${selected === v.id ? 'border-primary' : ''}`}
              onClick={() => {
                setSelected(v.id)
                setLabelEdit(v.label || '')
                void loadDiff(v.id)
              }}
            >
              <span className="font-medium">{v.label || v.kind || v.id.slice(0, 8)}</span>
              <span className="block text-[10px] text-muted-foreground">{new Date(v.createdAt).toLocaleString()}</span>
            </button>
          </li>
        ))}
      </ul>
      {selectedRow ? (
        <div className="space-y-2 rounded border p-2">
          <input className="w-full rounded border px-2 py-1 text-xs" value={labelEdit} onChange={(e) => setLabelEdit(e.target.value)} />
          <Button size="sm" variant="outline" onClick={() => void saveLabel()}>Save name</Button>
          <p className="text-[10px] font-medium">Preview</p>
          <p className="text-[10px] text-muted-foreground">
            {scenesFromPmJson(selectedRow.pmJson ?? { type: 'doc', content: [] }).length} scenes (snapshot)
            {' · '}
            {scenesFromPmJson(currentDoc).length} scenes (current)
          </p>
          {diffHtml ? <div className="max-h-32 overflow-auto text-[10px]" dangerouslySetInnerHTML={{ __html: diffHtml }} /> : null}
          <Button size="sm" variant="outline" onClick={() => onRestore(selectedRow.id)}>Restore snapshot</Button>
        </div>
      ) : null}
    </div>
  )
}

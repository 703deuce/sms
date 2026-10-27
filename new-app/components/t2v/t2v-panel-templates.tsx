'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { T2vTemplateListItem } from '@/lib/t2v/m9-contracts'
import type { T2vDraftV1 } from '@/lib/t2v/types'
export function T2vPanelTemplates({
  draftId,
  onApplied,
}: {
  draftId: string
  onApplied: (doc: T2vDraftV1, revision: number) => void
}) {
  const [items, setItems] = useState<T2vTemplateListItem[]>([])

  useEffect(() => {
    void fetch('/api/t2v/templates?limit=8')
      .then((r) => r.json())
      .then((b) => setItems(b.data?.items ?? []))
      .catch(() => {})
  }, [])

  const apply = async (id: string) => {
    const ok = window.confirm('Apply template? Style, music and transitions update; script and locked visuals stay.')
    if (!ok) return
    const res = await fetch(`/api/t2v/templates/${id}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftId }),
    })
    const body = await res.json()
    if (!res.ok) {
      toast.error(body.error ?? 'apply_failed')
      return
    }
    toast.success('Template applied')
    onApplied(body.data.document as T2vDraftV1, body.data.revision as number)
  }

  return (
    <div className="grid grid-cols-2 gap-2 p-4">
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          className="rounded-lg border border-border p-3 text-left text-sm hover:bg-muted/50"
          onClick={() => void apply(t.id)}
        >
          <p className="font-medium">{t.name}</p>
          <p className="text-xs text-muted-foreground">{t.aspect} · {t.category}</p>
        </button>
      ))}
      {items.length === 0 ? (
        <p className="col-span-2 text-sm text-muted-foreground">
          Style templates are being set up for your workspace. You can still adjust captions, transitions, and music in
          the other style tabs.
        </p>
      ) : null}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { clipsFetch } from '@/lib/clips-api'
import { cn } from '@/lib/utils'
import type { ScriptEditorSettings } from '@/lib/clips/script-edl/types'

type TemplateRow = { id: string; name: string; isDefault?: boolean }

export function ScriptLayoutsPanel({
  settings,
  onPatch,
}: {
  settings: ScriptEditorSettings
  onPatch: (patch: Partial<ScriptEditorSettings>) => void
}) {
  const [items, setItems] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void clipsFetch<{ items: TemplateRow[] }>('/api/clips/brand/templates')
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const active = settings.layoutPackId

  return (
    <div className="flex flex-col gap-3 p-3 text-sm" data-testid="script-layouts-panel">
      <p className="text-[13px] font-semibold">Layout packs</p>
      <p className="text-xs text-muted-foreground">Brand templates apply to new scenes (§9). Smart Fill ships with M9.</p>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No layout packs yet. Create one in Brand.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onPatch({ layoutPackId: t.id })}
                className={cn(
                  'flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-left text-xs',
                  active === t.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50',
                )}
              >
                <span className="truncate">{t.name}</span>
                {t.isDefault ? <span className="text-[10px] text-muted-foreground">Default</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

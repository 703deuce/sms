'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { clipsFetch } from '@/lib/clips-api'
import type { BrandTemplateSettings } from '@/lib/clips/brand'

type TemplateRow = {
  id: string
  name: string
  isDefault: boolean
  introVideoKey: string | null
  outroVideoKey: string | null
}

export function BrandTemplatesManager() {
  const [items, setItems] = useState<TemplateRow[]>([])
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    const data = await clipsFetch<{ items: TemplateRow[] }>('/api/clips/brand/templates')
    setItems(data.items || [])
  }, [])

  useEffect(() => {
    void refresh().catch(() => {})
  }, [refresh])

  const create = async () => {
    const name = window.prompt('Template name')
    if (!name?.trim()) return
    setBusy(true)
    try {
      await clipsFetch('/api/clips/brand/templates', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      })
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const setDefault = async (id: string) => {
    await clipsFetch(`/api/clips/brand/templates/${id}?action=set-default`, { method: 'POST', body: '{}' })
    await refresh()
  }

  const uploadBookend = async (id: string, kind: 'intro' | 'outro', file: File) => {
    setBusy(true)
    try {
      const form = new FormData()
      form.set('file', file)
      const res = await fetch(`/api/clips/brand/templates/${id}/bookend?kind=${kind}`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) throw new Error(await res.text())
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-8 space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Brand templates</p>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void create()}>New template</Button>
      </div>
      <ul className="space-y-2 text-xs">
        {items.map((t) => (
          <li key={t.id} className="rounded border border-border p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{t.name}{t.isDefault ? ' · default' : ''}</span>
              {!t.isDefault && (
                <Button size="sm" variant="ghost" onClick={() => void setDefault(t.id)}>Set default</Button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <label className="cursor-pointer underline">
                Intro MP4
                <input
                  type="file"
                  accept="video/mp4"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void uploadBookend(t.id, 'intro', f)
                  }}
                />
              </label>
              <label className="cursor-pointer underline">
                Outro MP4
                <input
                  type="file"
                  accept="video/mp4"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void uploadBookend(t.id, 'outro', f)
                  }}
                />
              </label>
              <span className="text-muted-foreground">
                {t.introVideoKey ? 'intro ✓' : 'no intro'} · {t.outroVideoKey ? 'outro ✓' : 'no outro'}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

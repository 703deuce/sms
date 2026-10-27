'use client'

import { useEffect, useState } from 'react'
import type { T2vDraftV1 } from '@/lib/t2v/types'
import { clipsFetch } from '@/lib/clips-api'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type TemplateRow = { id: string; name: string; isDefault: boolean }

export function T2vPanelBrand({
  doc,
  onChange,
}: {
  doc: T2vDraftV1
  onChange: (next: T2vDraftV1) => void
}) {
  const [templates, setTemplates] = useState<TemplateRow[]>([])

  useEffect(() => {
    void clipsFetch<{ items: TemplateRow[] }>('/api/clips/brand/templates')
      .then((d) => setTemplates(d.items ?? []))
      .catch(() => {})
  }, [])

  const value = doc.settings.brandTemplateId ?? ''

  return (
    <div className="space-y-3 p-4">
      <p className="text-sm text-muted-foreground">Brand intro/outro and colors apply at assemble and export.</p>
      <Label>Brand template</Label>
      <Select
        value={value || '__none'}
        onValueChange={(id) => {
          if (!id) return
          onChange({
            ...doc,
            settings: { ...doc.settings, brandTemplateId: id === '__none' ? undefined : id },
          })
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="None" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">None</SelectItem>
          {templates.map((t) => (
            <SelectItem key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (default)' : ''}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

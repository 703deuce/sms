'use client'

import { useEffect, useState } from 'react'
import type { T2vDraftV1 } from '@/lib/t2v/types'
import { clipsFetch } from '@/lib/clips-api'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { BrandTemplateSettings } from '@/lib/clips/brand'

type TemplateRow = {
  id: string
  name: string
  isDefault: boolean
  logoKey?: string | null
  introVideoKey?: string | null
  outroVideoKey?: string | null
  settings?: BrandTemplateSettings | null
}

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
          if (id === '__none') {
            onChange({
              ...doc,
              settings: { ...doc.settings, brandTemplateId: undefined, brand: undefined },
            })
            return
          }
          const t = templates.find((x) => x.id === id)
          const st = (t?.settings ?? {}) as BrandTemplateSettings
          onChange({
            ...doc,
            settings: {
              ...doc.settings,
              brandTemplateId: id,
              brand: t
                ? {
                    templateId: id,
                    logoKey: t.logoKey ?? undefined,
                    introVideoKey: t.introVideoKey ?? undefined,
                    outroVideoKey: t.outroVideoKey ?? undefined,
                    useIntro: Boolean(t.introVideoKey),
                    useOutro: Boolean(t.outroVideoKey),
                    primaryColor: st.primaryColor,
                    fontFamily: (st as { fontFamily?: string }).fontFamily,
                  }
                : undefined,
            },
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

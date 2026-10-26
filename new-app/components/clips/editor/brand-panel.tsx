'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { applyBrandTemplateToEdits } from '@/lib/clips/apply-brand'
import type { BrandTemplateSettings } from '@/lib/clips/brand'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { clipsFetch } from '@/lib/clips-api'

type TemplateRow = {
  id: string
  name: string
  isDefault: boolean
  logoKey: string | null
  introVideoKey: string | null
  outroVideoKey: string | null
  settings: BrandTemplateSettings
}

export function BrandPanel({
  edits,
  onEdits,
}: {
  edits: ClipEditsV2
  onEdits: (edits: ClipEditsV2) => void
}) {
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const brand = (edits.brand || {}) as {
    templateId?: string
    useIntro?: boolean
    useOutro?: boolean
  }

  const refresh = useCallback(async () => {
    const data = await clipsFetch<{ items: TemplateRow[] }>('/api/clips/brand/templates')
    setTemplates(data.items || [])
  }, [])

  useEffect(() => {
    void refresh().catch(() => {})
  }, [refresh])

  const applyTemplate = (tpl: TemplateRow) => {
    const next = applyBrandTemplateToEdits(edits, {
      id: tpl.id,
      logoKey: tpl.logoKey,
      introVideoKey: tpl.introVideoKey,
      outroVideoKey: tpl.outroVideoKey,
      settings: tpl.settings,
    })
    onEdits(next)
  }

  const patchBrand = (patch: Record<string, unknown>) => {
    onEdits({ ...edits, brand: { ...(edits.brand as object), ...patch } })
  }

  return (
    <div className="space-y-3 p-3 text-sm">
      <p className="text-xs text-muted-foreground">
        Pick a brand kit for this clip. Intro/outro apply on export when enabled.
      </p>
      <label className="block text-xs font-medium">Template</label>
      <select
        className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
        value={brand.templateId || ''}
        onChange={(e) => {
          const tpl = templates.find((t) => t.id === e.target.value)
          if (tpl) applyTemplate(tpl)
        }}
      >
        <option value="">Select template…</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}{t.isDefault ? ' (default)' : ''}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={brand.useIntro ?? false}
          disabled={!templates.find((t) => t.id === brand.templateId)?.introVideoKey}
          onChange={(e) => patchBrand({ useIntro: e.target.checked })}
        />
        Include intro bumper
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={brand.useOutro ?? false}
          disabled={!templates.find((t) => t.id === brand.templateId)?.outroVideoKey}
          onChange={(e) => patchBrand({ useOutro: e.target.checked })}
        />
        Include outro bumper
      </label>
      <Button size="sm" variant="outline" render={<a href="/app/clips/brand" />}>
        Manage templates
      </Button>
    </div>
  )
}

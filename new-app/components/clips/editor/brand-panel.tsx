'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
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
      <Label className="text-xs font-medium">Template</Label>
      <Select
        value={brand.templateId || ''}
        onValueChange={(v) => {
          if (typeof v !== 'string' || !v) return
          const tpl = templates.find((t) => t.id === v)
          if (tpl) applyTemplate(tpl)
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select template…" />
        </SelectTrigger>
        <SelectContent>
          {templates.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}{t.isDefault ? ' (default)' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">Include intro bumper</Label>
        <Switch
          checked={brand.useIntro ?? false}
          disabled={!templates.find((t) => t.id === brand.templateId)?.introVideoKey}
          onCheckedChange={(checked) => patchBrand({ useIntro: Boolean(checked) })}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">Include outro bumper</Label>
        <Switch
          checked={brand.useOutro ?? false}
          disabled={!templates.find((t) => t.id === brand.templateId)?.outroVideoKey}
          onCheckedChange={(checked) => patchBrand({ useOutro: Boolean(checked) })}
        />
      </div>
      <Button size="sm" variant="outline" render={<a href="/app/clips/brand" />}>
        Manage templates
      </Button>
    </div>
  )
}

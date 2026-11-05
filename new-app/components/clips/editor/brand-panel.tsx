'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { applyBrandTemplateToEdits, describeTemplateChange, templateAppliedMessage } from '@/lib/clips/apply-brand'
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
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
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
    void refresh().catch((e) => toast.error(e instanceof Error ? `Could not load templates: ${e.message}` : 'Could not load templates'))
  }, [refresh])

  const applyTemplate = (tpl: TemplateRow) => {
    try {
      const next = applyBrandTemplateToEdits(edits, {
        id: tpl.id,
        logoKey: tpl.logoKey,
        introVideoKey: tpl.introVideoKey,
        outroVideoKey: tpl.outroVideoKey,
        settings: tpl.settings,
      })
      onEdits(next)
      toast.success(templateAppliedMessage(tpl.name, describeTemplateChange(edits, next)))
    } catch (e) {
      toast.error(e instanceof Error ? `Template could not be applied: ${e.message}` : 'Template could not be applied')
    }
  }

  const selectedTemplate = templates.find((t) => t.id === (selectedTemplateId ?? brand.templateId))
  const appliedTemplate = templates.find((t) => t.id === brand.templateId)

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
        // E1fix: `items` lets the trigger show the template name (Base UI renders the raw id otherwise).
        items={templates.map((t) => ({ value: t.id, label: t.name }))}
        value={selectedTemplateId ?? (templates.some((t) => t.id === brand.templateId) ? brand.templateId! : null)}
        onValueChange={(v) => {
          if (typeof v !== 'string' || !v) return
          setSelectedTemplateId(v)
        }}
      >
        <SelectTrigger className="w-full" data-testid="brand-template-select">
          <SelectValue placeholder={templates.length ? 'Select template…' : 'Loading templates…'} />
        </SelectTrigger>
        <SelectContent>
          {templates.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}{t.isDefault ? ' (default)' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedTemplate ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2" data-testid="brand-template-preview">
          <span className="min-w-0 flex-1 text-xs">{selectedTemplate.name}{selectedTemplate.id === brand.templateId ? ' · Applied' : ' · Preview only'}</span>
          <Button size="sm" type="button" onClick={() => { applyTemplate(selectedTemplate); setSelectedTemplateId(null) }} data-testid="brand-template-apply">Apply kit</Button>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">Include intro bumper</Label>
        <Switch
          checked={brand.useIntro ?? false}
          disabled={!appliedTemplate?.introVideoKey}
          onCheckedChange={(checked) => patchBrand({ useIntro: Boolean(checked) })}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">Include outro bumper</Label>
        <Switch
          checked={brand.useOutro ?? false}
          disabled={!appliedTemplate?.outroVideoKey}
          onCheckedChange={(checked) => patchBrand({ useOutro: Boolean(checked) })}
        />
      </div>
      {appliedTemplate && (!appliedTemplate.introVideoKey || !appliedTemplate.outroVideoKey) ? (
        <p className="text-xs text-muted-foreground" data-testid="brand-bumper-upload-hint">Bumper switches require an uploaded Intro/Outro MP4 on this template. Use Manage templates to upload the missing videos first.</p>
      ) : null}
      <Button size="sm" variant="outline" render={<a href="/app/clips/brand" />}>
        Manage templates
      </Button>
    </div>
  )
}

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
  previewOnly = false,
}: {
  edits: ClipEditsV2
  onEdits: (edits: ClipEditsV2) => void
  /** Template-mode guard: preview/apply kit fields locally without uploading brand assets. */
  previewOnly?: boolean
}) {
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [bumperUploading, setBumperUploading] = useState<'intro' | 'outro' | null>(null)
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

  const uploadBumper = async (kind: 'intro' | 'outro', file: File | undefined) => {
    if (previewOnly) {
      toast.message('Upload brand assets from Manage templates; this customizer is preview-only')
      return
    }
    if (!file || !appliedTemplate) return
    if (file.size > 80 * 1024 * 1024) {
      toast.error('Bumper MP4 must be under 80 MB')
      return
    }
    setBumperUploading(kind)
    try {
      const form = new FormData()
      form.set('file', file)
      const res = await fetch(`/api/clips/brand/templates/${encodeURIComponent(appliedTemplate.id)}/bookend?kind=${kind}`, { method: 'POST', body: form })
      if (!res.ok) throw new Error('Could not upload bumper MP4')
      const data = await res.json() as { data?: { key?: string } }
      const key = data.data?.key
      if (!key) throw new Error('Bumper upload returned no media key')
      onEdits({ ...edits, brand: { ...(edits.brand as object), [kind === 'intro' ? 'introVideoKey' : 'outroVideoKey']: key, [kind === 'intro' ? 'useIntro' : 'useOutro']: true } })
      await refresh()
      toast.success(`${kind === 'intro' ? 'Intro' : 'Outro'} bumper uploaded and enabled`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bumper upload failed')
    } finally {
      setBumperUploading(null)
    }
  }

  const patchBrand = (patch: Record<string, unknown>) => {
    onEdits({ ...edits, brand: { ...(edits.brand as object), ...patch } })
  }

  return (
    <div className="space-y-3 p-3 text-sm">
      <p className="text-xs text-muted-foreground">
        {previewOnly
          ? 'Preview a saved brand kit locally. Asset uploads stay in Manage templates.'
          : 'Pick a brand kit for this clip. Intro/outro apply on export when enabled.'}
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
      {appliedTemplate && !previewOnly ? (
        <div className="flex flex-wrap gap-3" data-testid="brand-bumper-uploads">
          {(['intro', 'outro'] as const).map((kind) => (
            <label key={kind} className="cursor-pointer text-xs text-primary underline">
              {bumperUploading === kind ? 'Uploading…' : `Upload ${kind} MP4`}
              <input type="file" accept="video/mp4,.mp4" className="sr-only" disabled={!!bumperUploading}
                data-testid={`brand-upload-${kind}`}
                onChange={(ev) => { void uploadBumper(kind, ev.target.files?.[0]); ev.target.value = '' }} />
            </label>
          ))}
        </div>
      ) : null}
      <Button size="sm" variant="outline" render={<a href="/app/clips/brand" />}>
        Manage templates
      </Button>
    </div>
  )
}

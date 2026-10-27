'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { batchClips, clipsFetch } from '@/lib/clips-api'
import type { ExportAspect } from '@/lib/clips/export-aspect'
import { Download, LayoutTemplate, Sparkles } from 'lucide-react'

type TemplateRow = { id: string; name: string; isDefault: boolean }

export function ClipResultsToolbar({
  projectId,
  selectedIds,
  onClear,
  exportAspect = '9:16',
  onApplied,
}: {
  projectId: string
  selectedIds: string[]
  onClear: () => void
  exportAspect?: ExportAspect
  onApplied?: () => void
}) {
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [busy, setBusy] = useState(false)

  const loadTemplates = useCallback(async () => {
    const data = await clipsFetch<{ items: TemplateRow[] }>('/api/clips/brand/templates')
    setTemplates(data.items || [])
  }, [])

  useEffect(() => {
    if (selectedIds.length) void loadTemplates().catch(() => {})
  }, [selectedIds.length, loadTemplates])

  if (!selectedIds.length) return null

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
      onApplied?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm"
      role="status"
      aria-live="polite"
    >
      <span className="font-medium">{selectedIds.length} selected</span>
      <Button size="sm" variant="outline" disabled={busy} onClick={onClear}>Clear</Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button size="sm" variant="outline" disabled={busy} />}>
          <LayoutTemplate className="mr-1 size-4" />
          Apply template
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {templates.length === 0 ? (
            <DropdownMenuItem disabled>No templates — save one in Brand or the editor</DropdownMenuItem>
          ) : (
            templates.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onClick={() =>
                  void run(async () => {
                    await batchClips({
                      clipIds: selectedIds,
                      action: 'apply-template',
                      templateId: t.id,
                    })
                    toast.success(`Applied “${t.name}” to ${selectedIds.length} clips`)
                    onClear()
                  })
                }
              >
                {t.name}{t.isDefault ? ' (default)' : ''}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        size="sm"
        variant="default"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            const data = await batchClips({
              clipIds: selectedIds,
              action: 'export',
              projectId,
              aspect: exportAspect,
              resolution: '1080p',
            })
            if (data.batchId) {
              window.location.href = `/api/clips/projects/${projectId}/export-all?batchId=${encodeURIComponent(data.batchId)}`
            }
            toast.success(`Export queued for ${selectedIds.length} clips`)
          })
        }
      >
        <Sparkles className="mr-1 size-4" />
        Export selected
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            const { exportClipDownload } = await import('@/lib/clips/export-download-client')
            const { CLIP_PREVIEW_EXPORT_ASPECT } = await import('@/lib/clips/export-preview-reuse')
            for (const id of selectedIds) {
              await exportClipDownload(id, { aspect: CLIP_PREVIEW_EXPORT_ASPECT })
            }
            toast.success(`Downloaded ${selectedIds.length} clips`)
          })
        }
      >
        <Download className="mr-1 size-4" />
        Download
      </Button>
    </div>
  )
}

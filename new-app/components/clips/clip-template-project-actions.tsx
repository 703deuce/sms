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
import { applyProjectTemplate, clipsFetch } from '@/lib/clips-api'
import { LayoutTemplate } from 'lucide-react'

type TemplateRow = { id: string; name: string; isDefault: boolean }

export function ClipTemplateProjectActions({
  projectId,
  onApplied,
}: {
  projectId: string
  onApplied?: () => void
}) {
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    const data = await clipsFetch<{ items: TemplateRow[] }>('/api/clips/brand/templates')
    setTemplates(data.items || [])
  }, [])

  useEffect(() => {
    void refresh().catch(() => {})
  }, [refresh])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm" variant="outline" disabled={busy} />}>
        <LayoutTemplate className="mr-1 size-4" />
        Apply template to all
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {templates.length === 0 ? (
          <DropdownMenuItem disabled>Save a clip template in Brand or the editor first</DropdownMenuItem>
        ) : (
          templates.map((t) => (
            <DropdownMenuItem
              key={t.id}
              onClick={() => {
                setBusy(true)
                void applyProjectTemplate(projectId, t.id)
                  .then((r) => {
                    toast.success(`Updated ${r.updated} clips with “${t.name}”`)
                    onApplied?.()
                  })
                  .catch((e) => toast.error(e instanceof Error ? e.message : 'Apply failed'))
                  .finally(() => setBusy(false))
              }}
            >
              {t.name}{t.isDefault ? ' (default)' : ''}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

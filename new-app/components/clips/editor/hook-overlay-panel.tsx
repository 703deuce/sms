'use client'

import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { clipsFetch } from '@/lib/clips-api'

export function HookOverlayPanel({
  clipId,
  edits,
  defaultHook,
  onChange,
}: {
  clipId: string
  edits: ClipEditsV2
  defaultHook?: string
  onChange: (patch: Partial<ClipEditsV2>) => void
}) {
  const ho = edits.hookOverlay || { enabled: false, text: defaultHook || '', durationMs: 2500 }
  const setHook = (patch: Partial<NonNullable<ClipEditsV2['hookOverlay']>>) => {
    onChange({
      hookOverlay: {
        enabled: ho.enabled,
        text: ho.text,
        durationMs: ho.durationMs ?? 2500,
        ...patch,
      },
    })
  }

  const suggest = async () => {
    try {
      const res = await clipsFetch<{ hookText: string }>(`/api/clips/clips/${clipId}/post-copy`, {
        method: 'POST',
        body: '{}',
      })
      setHook({ text: res.hookText, enabled: true })
      toast.success('Hook text updated from AI')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not suggest hook')
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">Hook title overlay</h3>
          <p className="text-xs text-muted-foreground">First 2–3s on export — uses brand primary color</p>
        </div>
        <Switch
          checked={Boolean(ho.enabled)}
          onCheckedChange={(checked) => setHook({ enabled: Boolean(checked) })}
          aria-label="Enable hook title overlay"
        />
      </div>
      {ho.enabled ? (
        <>
          <div className="space-y-1">
            <Label htmlFor="hook-overlay-text">Hook text</Label>
            <Input
              id="hook-overlay-text"
              value={ho.text || ''}
              maxLength={120}
              onChange={(e) => setHook({ text: e.target.value })}
              placeholder="Stop scrolling — here's why…"
            />
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => void suggest()}>
            <Sparkles className="mr-1 size-3.5" aria-hidden />
            Suggest with AI
          </Button>
        </>
      ) : null}
    </section>
  )
}

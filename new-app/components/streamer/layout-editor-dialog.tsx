'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { clipsFetch } from '@/lib/clips-api'
import { stackHeights } from '@/lib/streamer/layout-math'

type NormBox = { x: number; y: number; w: number; h: number }

export function LayoutEditorDialog({
  projectId,
  open,
  onOpenChange,
  initialLayout,
}: {
  projectId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  initialLayout: Record<string, unknown> | null
}) {
  const [layout, setLayout] = useState<'stack' | 'gameplay'>('stack')
  const [facecam, setFacecam] = useState<NormBox>({ x: 0.02, y: 0.02, w: 0.32, h: 0.28 })
  const [split, setSplit] = useState(0.4)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const l = initialLayout as { layout?: string; facecam?: NormBox; split?: number } | null
    if (l?.layout === 'gameplay') setLayout('gameplay')
    else setLayout('stack')
    if (l?.facecam) setFacecam(l.facecam)
    if (typeof l?.split === 'number') setSplit(l.split)
  }, [open, initialLayout])

  const { faceH, gameH } = stackHeights(split)

  const apply = async (mode: 'all' | 'gameplay') => {
    setSaving(true)
    try {
      await clipsFetch('/api/streamer/projects/' + projectId + '/layout', {
        method: 'POST',
        body: JSON.stringify({
          layout: mode === 'gameplay' ? 'gameplay' : 'stack',
          facecam: mode === 'gameplay' ? null : facecam,
          split,
          facecamPosition: 'top',
          rerender: 'all',
        }),
      })
      toast.success('Layout saved; clips are re-rendering')
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save layout')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Streamer layout</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Adjust facecam crop for 9:16 stack renders. Preview heights: face {faceH}px · gameplay {gameH}px.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Label>Facecam X</Label>
            <Slider
              min={0}
              max={100}
              value={[Math.round(facecam.x * 100)]}
              onValueChange={(v) => {
                const n = Array.isArray(v) ? v[0] ?? 0 : 0
                setFacecam((f) => ({ ...f, x: n / 100 }))
              }}
            />
            <Label>Facecam Y</Label>
            <Slider
              min={0}
              max={100}
              value={[Math.round(facecam.y * 100)]}
              onValueChange={(v) => {
                const n = Array.isArray(v) ? v[0] ?? 0 : 0
                setFacecam((f) => ({ ...f, y: n / 100 }))
              }}
            />
            <Label>Split</Label>
            <Slider
              min={25}
              max={50}
              value={[Math.round(split * 100)]}
              onValueChange={(v) => {
                const n = Array.isArray(v) ? v[0] ?? 40 : 40
                setSplit(n / 100)
              }}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={saving} onClick={() => void apply('gameplay')}>
            No facecam
          </Button>
          <Button type="button" disabled={saving} onClick={() => void apply('all')}>
            Apply to all clips
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { FacecamLayoutState } from '@/lib/server/clips/clip-detail'

type NormBox = { x: number; y: number; w: number; h: number }

function defaultFacecam(): NormBox {
  return { x: 0.02, y: 0.02, w: 0.32, h: 0.28 }
}

export function FacecamLayoutControls({
  edits,
  facecamLayout,
  onEdits,
}: {
  edits: ClipEditsV2
  facecamLayout: FacecamLayoutState | null
  onEdits: (edits: ClipEditsV2) => void
}) {
  const mode = edits.layout.mode
  if (mode !== 'facecam_stack' && mode !== 'facecam_pip') return null

  const fc = edits.layout.facecam
  const box = fc?.box ?? facecamLayout?.facecam ?? defaultFacecam()
  const split = fc?.split ?? facecamLayout?.split ?? 0.35
  const position = fc?.position ?? facecamLayout?.facecamPosition ?? 'top'

  const patchFacecam = (patch: Partial<NonNullable<ClipEditsV2['layout']['facecam']>>) => {
    onEdits({
      ...edits,
      layout: {
        ...edits.layout,
        facecam: {
          box,
          split,
          position,
          gameplay: fc?.gameplay ?? facecamLayout?.gameplay ?? undefined,
          pipCorner: fc?.pipCorner,
          ...patch,
        },
      },
    })
  }

  const snapDetected = () => {
    if (!facecamLayout?.facecam) return
    patchFacecam({
      box: facecamLayout.facecam,
      gameplay: facecamLayout.gameplay ?? undefined,
      split: facecamLayout.split ?? 0.35,
      position: facecamLayout.facecamPosition ?? 'top',
    })
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <p className="text-xs font-medium text-foreground">Facecam & gameplay boxes</p>
      <p className="text-xs text-muted-foreground">
        Drag-style sliders adjust normalized crops on the 16:9 source. Preview updates live.
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {(['x', 'y', 'w', 'h'] as const).map((key) => (
          <div key={key} className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Face {key}</Label>
            <Slider
              min={0}
              max={100}
              value={[Math.round(box[key] * 100)]}
              onValueChange={(v) => {
                const n = Array.isArray(v) ? v[0] ?? 0 : 0
                patchFacecam({ box: { ...box, [key]: n / 100 } })
              }}
            />
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Stack split (top panel {Math.round(split * 100)}%)</Label>
        <Slider
          min={20}
          max={50}
          value={[Math.round(split * 100)]}
          onValueChange={(v) => {
            const n = Array.isArray(v) ? v[0] ?? 35 : 35
            patchFacecam({ split: n / 100 })
          }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={snapDetected} disabled={!facecamLayout?.facecam}>
          Snap to detected facecam
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => patchFacecam({ position: position === 'top' ? 'bottom' : 'top' })}
        >
          Swap top / bottom
        </Button>
      </div>
    </div>
  )
}

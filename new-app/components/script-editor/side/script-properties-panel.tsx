'use client'

import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import type { ScriptAspect, ScriptEditorSettings, ScriptReframeMode } from '@/lib/clips/script-edl/types'
import { cn } from '@/lib/utils'

const ASPECTS: ScriptAspect[] = ['9:16', '1:1', '4:5', '16:9']
const REFRAME: { id: ScriptReframeMode; label: string }[] = [
  { id: 'speaker_follow', label: 'Auto (speaker)' },
  { id: 'center_crop', label: 'Center' },
  { id: 'manual', label: 'Manual' },
]

export function ScriptPropertiesPanel({
  settings,
  onPatch,
}: {
  settings: ScriptEditorSettings
  onPatch: (patch: Partial<ScriptEditorSettings>) => void
}) {
  const vol = settings.volumePct ?? 100

  return (
    <div className="flex flex-col gap-4 p-3 text-sm" data-testid="script-properties-panel">
      <div>
        <p className="mb-2 font-medium">Aspect ratio</p>
        <div className="flex flex-wrap gap-1.5">
          {ASPECTS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => onPatch({ aspect: a })}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs font-medium',
                settings.aspect === a ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50',
              )}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 font-medium">Reframe</p>
        <div className="flex flex-col gap-1">
          {REFRAME.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onPatch({ reframeMode: r.id })}
              className={cn(
                'rounded-md border px-2.5 py-1.5 text-left text-xs',
                settings.reframeMode === r.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm">Captions on canvas</span>
        <Switch
          checked={settings.captionsEnabled !== false}
          onCheckedChange={(v) => onPatch({ captionsEnabled: v })}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm">Show deleted (cuts)</span>
        <Switch
          checked={settings.showDeletedWords !== false}
          onCheckedChange={(v) => onPatch({ showDeletedWords: v })}
        />
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="font-medium">Volume</span>
          <span className="text-xs tabular-nums text-muted-foreground">{vol}%</span>
        </div>
        <Slider
          min={0}
          max={200}
          step={1}
          value={[vol]}
          onValueChange={(v) => {
            const n = Array.isArray(v) ? v[0] : vol
            if (typeof n === 'number') onPatch({ volumePct: n })
          }}
        />
      </div>
    </div>
  )
}

'use client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { BeatCutStrength } from '@/lib/clips/editor/strong-beats'

export function BeatCutControls({
  disabled,
  strength = 'all',
  onStrengthChange,
  onCut,
}: {
  disabled?: boolean
  strength?: BeatCutStrength
  onStrengthChange?: (strength: BeatCutStrength) => void
  onCut: (every: 1 | 2 | 4) => void
}) {
  return (
    <div className="space-y-2" data-testid="audio-beat-cut">
      <Label className="text-xs font-medium">Beats</Label>
      <p className="text-[10px] text-muted-foreground">
        Detected on music in the timeline. Cuts the video segment at the playhead (or selected B-roll) to beat marks.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          defaultValue="1"
          disabled={disabled}
          data-testid="audio-beat-cut-select"
          onChange={(e) => {
            const v = Number(e.target.value)
            if (v === 1 || v === 2 || v === 4) onCut(v)
          }}
        >
          <option value="1">Every beat</option>
          <option value="2">Every 2 beats</option>
          <option value="4">Every 4 beats</option>
        </select>
        {onStrengthChange ? (
          <div className="flex items-center gap-2">
            <Switch
              id="beat-strong-only"
              checked={strength === 'strong'}
              disabled={disabled}
              onCheckedChange={(on) => onStrengthChange(on ? 'strong' : 'all')}
              data-testid="audio-beat-strong-only"
            />
            <Label htmlFor="beat-strong-only" className="text-[10px] font-normal">
              Strong beats only
            </Label>
          </div>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={disabled}
          data-testid="audio-beat-cut-run"
          onClick={() => onCut(1)}
        >
          Cut to beat
        </Button>
      </div>
    </div>
  )
}

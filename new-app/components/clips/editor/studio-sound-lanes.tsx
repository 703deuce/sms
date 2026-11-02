'use client'

import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  patchStudioSoundLane,
  readStudioSoundLanes,
  STUDIO_SOUND_LANE_LABEL,
  type StudioSoundLane,
} from '@/lib/clips/editor/studio-sound-tracks'
import type { ClipEditsV2 } from '@/lib/clips/edits'

function LaneMixSlider({
  lane,
  mix,
  onCommit,
}: {
  lane: StudioSoundLane
  mix: number
  onCommit: (mix: number) => void
}) {
  const [draft, setDraft] = useState(Math.round(mix * 100))
  useEffect(() => {
    setDraft(Math.round(mix * 100))
  }, [mix])

  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">Strength</Label>
      <p className="text-[11px] text-muted-foreground">Applies on export (no preview).</p>
      <Slider
        min={0}
        max={100}
        step={1}
        value={[draft]}
        onValueChange={(v) => {
          const n = Array.isArray(v) ? v[0] : v
          if (typeof n === 'number') setDraft(n)
        }}
        onValueCommitted={(v) => {
          const n = Array.isArray(v) ? v[0] : v
          if (typeof n === 'number') onCommit(n / 100)
        }}
        data-testid={`studio-sound-${lane}-mix`}
      />
    </div>
  )
}

/** Q6.1: music + voiceover bus denoise (voice uses main Studio Sound block above). */
export function StudioSoundTrackLanes({
  edits,
  onLanePass,
}: {
  edits: ClipEditsV2
  onLanePass: (next: ClipEditsV2, label: string) => void
}) {
  const lanes = readStudioSoundLanes(edits)

  const patchLane = (lane: StudioSoundLane, enabled: boolean, mix: number) => {
    const next = patchStudioSoundLane(edits, lane, { enabled, mix })
    onLanePass(next, `Studio Sound: ${STUDIO_SOUND_LANE_LABEL[lane]}`)
  }

  return (
    <div className="space-y-2" data-testid="studio-sound-track-lanes">
      {(['music', 'voiceover'] as const).map((lane) => {
        const state = lanes[lane]
        return (
          <div key={lane} className="space-y-2 rounded border border-dashed p-2" data-testid={`studio-sound-lane-${lane}`}>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs font-medium">{STUDIO_SOUND_LANE_LABEL[lane]}</Label>
              <Switch
                checked={state.enabled}
                onCheckedChange={(on) => patchLane(lane, on === true, state.mix)}
                data-testid={`studio-sound-${lane}-toggle`}
              />
            </div>
            {state.enabled ? (
              <LaneMixSlider lane={lane} mix={state.mix} onCommit={(m) => patchLane(lane, true, m)} />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

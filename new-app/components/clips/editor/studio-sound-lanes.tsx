'use client'

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
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Strength</Label>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[Math.round(state.mix * 100)]}
                  onValueCommit={(v) => patchLane(lane, true, (v[0] ?? 100) / 100)}
                  data-testid={`studio-sound-${lane}-mix`}
                />
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

'use client'

import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import type { useGeneration } from '@/components/clips/editor/use-generation'

export type StudioSoundUiState = {
  enabled: boolean
  mix: number
  generationId: string | null
}

export function StudioSoundControls({
  studio,
  studioGen,
  defaultMix,
  onChange,
  onRetryEnqueue,
}: {
  studio: StudioSoundUiState | null
  studioGen: ReturnType<typeof useGeneration>
  defaultMix: number
  onChange: (next: StudioSoundUiState) => void
  onRetryEnqueue?: () => void
}) {
  const mix = studio?.mix ?? defaultMix
  const studioBusy = studioGen.running
  const studioProgress =
    studioGen.status === 'RUNNING' ? 55 : studioGen.status === 'PENDING' ? 20 : studioGen.status === 'READY' ? 100 : 0

  return (
    <div className="rounded-[10px] border border-border bg-muted/20 p-3" data-testid="studio-sound-controls">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[13px] font-semibold">Studio Sound</Label>
        {studioBusy ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground" data-testid="studio-sound-processing">
            <Loader2 className="size-3.5 animate-spin" />
            {studioProgress}%
          </span>
        ) : (
          <Switch
            checked={studio?.enabled ?? false}
            onCheckedChange={(enabled) => {
              onChange({
                enabled,
                mix,
                generationId: studio?.generationId ?? null,
              })
            }}
          />
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {studioGen.status === 'READY'
          ? 'Preview uses enhanced audio. Export mixes isolated + original by intensity.'
          : 'Speech isolation on the worker when enabled (off by default).'}
      </p>
      {studioGen.failed && studio?.enabled && onRetryEnqueue ? (
        <Button type="button" size="sm" variant="outline" className="mt-2 h-7" onClick={onRetryEnqueue}>
          Retry Studio Sound
        </Button>
      ) : null}
      {studio?.enabled && !studioBusy && (
        <div className="mt-3 space-y-2">
          <p className="text-xs">Intensity {Math.round(mix * 100)}%</p>
          <Slider
            value={[Math.round(mix * 100)]}
            min={0}
            max={100}
            step={5}
            onValueChange={(v) => {
              const first = Array.isArray(v) ? v[0] : v
              onChange({
                enabled: true,
                mix: (first ?? Math.round(defaultMix * 100)) / 100,
                generationId: studio?.generationId ?? null,
              })
            }}
          />
        </div>
      )}
    </div>
  )
}

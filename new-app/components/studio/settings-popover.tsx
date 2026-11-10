'use client'

import type { StudioAspect, StudioModel } from '../../lib/ai-studio/contract'
import { STUDIO_ASPECTS } from '../../lib/ai-studio/contract'
import type { StudioController, StudioSessionState } from '../../lib/ai-studio/controller'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Slider } from '../ui/slider'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '../ui/popover'
import { cn } from '../../lib/utils'

const ASPECT_GLYPH: Record<StudioAspect, string> = {
  '16:9': '▬',
  '9:16': '▮',
  '1:1': '■',
}

function DisabledTip({ label, disabled, reason, children }: { label: string; disabled: boolean; reason: string; children: React.ReactNode }) {
  if (!disabled) return <>{children}</>
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex">{children}</span>} />
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  )
}

export function settingsSummary(state: StudioSessionState): string {
  const parts: string[] = []
  if (state.form.aspect) parts.push(state.form.aspect)
  if (state.form.durationSec != null) parts.push(`${state.form.durationSec}s`)
  if (state.form.resolution) parts.push(state.form.resolution)
  return parts.join(' · ') || 'Settings'
}

export function SettingsPopover({
  state,
  controller,
  model,
  allResolutions,
}: {
  state: StudioSessionState
  controller: StudioController
  model: StudioModel | null
  allResolutions: string[]
}) {
  const generating = state.phase === 'submitting' || state.phase === 'polling'
  const summary = settingsSummary(state)
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-between font-medium"
            data-testid="studio-settings-chip"
            disabled={!model}
          />
        }
      >
        <span className="truncate">{summary}</span>
        <span className="text-muted-foreground">Edit</span>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <PopoverHeader className="mb-3 p-0">
          <PopoverTitle>Settings</PopoverTitle>
        </PopoverHeader>
        <TooltipProvider>
          <div className="flex flex-col gap-4">
            {model && model.durationsSec.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Duration</Label>
                  <span className="font-mono text-xs tabular-nums">{state.form.durationSec ?? model.durationsSec[0]}s</span>
                </div>
                <Slider
                  min={model.durationsSec[0]}
                  max={model.durationsSec[model.durationsSec.length - 1]}
                  step={1}
                  value={[state.form.durationSec ?? model.durationsSec[0]]}
                  onValueChange={(v) => {
                    const n = Array.isArray(v) ? v[0] : v
                    if (typeof n === 'number') controller.setDurationSec(n)
                  }}
                  aria-label="Duration in seconds"
                  disabled={generating}
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label className="text-xs">Aspect ratio</Label>
              <div role="group" aria-label="Aspect ratio" className="grid grid-cols-3 gap-1.5">
                {STUDIO_ASPECTS.map((a) => {
                  const allowed = !model || model.aspects.includes(a)
                  const on = state.form.aspect === a
                  return (
                    <DisabledTip key={a} label={a} disabled={!allowed} reason="Not available on this model">
                      <button
                        type="button"
                        disabled={generating || !allowed}
                        aria-pressed={on}
                        className={cn(
                          'flex h-8 w-full items-center justify-center gap-1.5 rounded-md border text-xs font-medium transition-colors',
                          'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50',
                          on ? 'border-border bg-muted text-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted/60',
                        )}
                        onClick={() => allowed && controller.setAspect(a)}
                      >
                        <span aria-hidden>{ASPECT_GLYPH[a]}</span>
                        {a}
                      </button>
                    </DisabledTip>
                  )
                })}
              </div>
            </div>
            {allResolutions.length > 0 && (
              <div className="flex flex-col gap-2">
                <Label className="text-xs">Quality</Label>
                <div role="listbox" aria-label="Quality" className="grid grid-cols-2 gap-1.5">
                  {allResolutions.map((r) => {
                    const allowed = !model || model.resolutions.length === 0 || model.resolutions.includes(r)
                    const on = state.form.resolution === r
                    return (
                      <DisabledTip key={r} label={r} disabled={!allowed} reason="Not available on this model">
                        <button
                          type="button"
                          disabled={generating || !allowed}
                          aria-pressed={on}
                          className={cn(
                            'flex h-8 w-full items-center justify-center rounded-md border text-xs font-medium transition-colors',
                            'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50',
                            on ? 'border-border bg-muted text-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted/60',
                          )}
                          onClick={() => allowed && controller.setResolution(r)}
                        >
                          {r}
                        </button>
                      </DisabledTip>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </TooltipProvider>
      </PopoverContent>
    </Popover>
  )
}

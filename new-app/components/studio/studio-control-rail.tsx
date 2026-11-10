'use client'

import { useState } from 'react'
import { ArrowUpDown, LoaderCircle } from 'lucide-react'
import type { StudioMode, StudioModel } from '../../lib/ai-studio/contract'
import { STUDIO_MODES } from '../../lib/ai-studio/contract'
import { PROMPT_PRESETS } from '../../lib/ai-studio/catalog'
import { modeLabel } from '../../lib/ai-studio/format'
import type { StudioController, StudioSessionState } from '../../lib/ai-studio/controller'
import { selectedModel } from '../../lib/ai-studio/controller'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { Label } from '../ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'
import { ModelCard, ModelPicker } from './model-picker'
import { ReferenceUpload } from './reference-upload'
import { SettingsPopover } from './settings-popover'
import { cn } from '../../lib/utils'

export function StudioControlRail({
  state,
  controller,
}: {
  state: StudioSessionState
  controller: StudioController
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const model = selectedModel(state.models, state.form.modelId)
  const showReference = !!model?.supportsReferenceImage
  const showFrames = !!model?.supportsStartEndFrame
  const presets = PROMPT_PRESETS[state.form.mode] ?? []
  const generating = state.phase === 'submitting' || state.phase === 'polling'
  const allResolutions = uniqueResolutions(state.models)

  function onSelectModeModel(next: StudioModel) {
    controller.setModel(next.id)
    if (!next.modes.includes(state.form.mode) && next.modes[0]) controller.setMode(next.modes[0])
  }

  return (
    <aside
      data-testid="studio-control-rail"
      className="flex w-full shrink-0 flex-col border-b border-border bg-background md:w-[380px] md:border-r md:border-b-0"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
        <ModeSelect
          model={model}
          mode={state.form.mode}
          disabled={generating}
          onChange={(m) => controller.setMode(m)}
        />

        <ModelCard model={model} onChange={() => setPickerOpen(true)} />
        <ModelPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          models={state.models}
          selectedId={state.form.modelId}
          onSelect={(id) => {
            const next = state.models.find((m) => m.id === id)
            if (next) onSelectModeModel(next)
            else controller.setModel(id)
          }}
        />

        {(showReference || showFrames) && (
          <section className="flex flex-col gap-3" aria-label="Reference media">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-medium text-muted-foreground">Media</h2>
              {showFrames && (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  data-testid="studio-swap-frames"
                  disabled={generating || (!state.form.assets.start_frame && !state.form.assets.end_frame)}
                  onClick={() => controller.swapFrames()}
                >
                  <ArrowUpDown className="size-3" aria-hidden />
                  Swap frames
                </Button>
              )}
            </div>
            <div className={cn('grid gap-3', showFrames ? 'grid-cols-2' : 'grid-cols-1')}>
              {showReference && !showFrames && (
                <ReferenceUpload
                  slot="reference"
                  asset={state.form.assets.reference}
                  onChange={(file) => controller.setAsset('reference', file)}
                  disabled={generating}
                />
              )}
              {showFrames && (
                <>
                  <ReferenceUpload
                    slot="start_frame"
                    asset={state.form.assets.start_frame}
                    onChange={(file) => controller.setAsset('start_frame', file)}
                    disabled={generating}
                  />
                  <ReferenceUpload
                    slot="end_frame"
                    asset={state.form.assets.end_frame}
                    onChange={(file) => controller.setAsset('end_frame', file)}
                    disabled={generating}
                  />
                </>
              )}
            </div>
            {showReference && showFrames && (
              <ReferenceUpload
                slot="reference"
                asset={state.form.assets.reference}
                onChange={(file) => controller.setAsset('reference', file)}
                disabled={generating}
              />
            )}
          </section>
        )}

        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <Label htmlFor="studio-prompt" className="text-xs font-medium">
              Prompt
            </Label>
            <span className="font-mono text-xs tabular-nums text-muted-foreground" aria-live="polite">
              {state.form.prompt.length}
            </span>
          </div>
          <Textarea
            id="studio-prompt"
            value={state.form.prompt}
            disabled={generating}
            placeholder={
              state.form.mode === 'image_to_video'
                ? 'Describe the motion between the frames or from the reference…'
                : state.form.mode === 'text_to_image'
                  ? 'Describe the image you want to create…'
                  : 'Describe the video you want to create…'
            }
            className="min-h-28 resize-y"
            onChange={(e) => controller.setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault()
                if (state.canSubmit) void controller.generate()
              }
            }}
          />
          {presets.length > 0 && (
            <div className="flex flex-wrap gap-1.5" aria-label="Example prompts" data-testid="studio-prompt-presets">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={generating}
                  className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
                  onClick={() => controller.setPrompt(p.prompt)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </section>

        <SettingsPopover state={state} controller={controller} model={model} allResolutions={allResolutions} />

        {state.lastError && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.lastError.message}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 z-10 border-t border-border bg-background p-4">
        <Button
          type="button"
          size="lg"
          className="w-full"
          data-testid="studio-generate"
          disabled={!state.canSubmit}
          aria-describedby="studio-generate-reason"
          onClick={() => void controller.generate()}
        >
          {generating && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {state.generateLabel}
        </Button>
        <p id="studio-generate-reason" className="mt-2 text-center text-xs text-muted-foreground">
          {state.submitBlockedReason || 'Placeholder estimate. Credits are not charged in v1.'}
        </p>
      </div>
    </aside>
  )
}

function ModeSelect({
  model,
  mode,
  disabled,
  onChange,
}: {
  model: StudioModel | null
  mode: StudioMode
  disabled?: boolean
  onChange: (mode: StudioMode) => void
}) {
  return (
    <TooltipProvider>
      <div role="group" aria-label="Generation mode" className="grid grid-cols-1 gap-1" data-testid="studio-mode-select">
        <div className="flex flex-wrap gap-1.5">
          {STUDIO_MODES.map((m) => {
            const allowed = !model || model.modes.includes(m)
            const on = mode === m
            const btn = (
              <button
                key={m}
                type="button"
                disabled={disabled || !allowed}
                aria-pressed={on}
                data-mode={m}
                className={cn(
                  'rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                  'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50',
                  on ? 'border-border bg-muted text-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted/60',
                )}
                onClick={() => allowed && onChange(m)}
              >
                {modeLabel(m)}
              </button>
            )
            if (allowed) return btn
            return (
              <Tooltip key={m}>
                <TooltipTrigger render={<span className="inline-flex">{btn}</span>} />
                <TooltipContent>Not available on this model</TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </div>
    </TooltipProvider>
  )
}

function uniqueResolutions(models: StudioModel[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of models) {
    for (const r of m.resolutions) {
      if (!seen.has(r)) {
        seen.add(r)
        out.push(r)
      }
    }
  }
  return out
}

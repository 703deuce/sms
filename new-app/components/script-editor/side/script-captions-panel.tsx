'use client'

import { CaptionMiniPreview } from '@/components/clips/editor/caption-overlay'
import { CAPTION_PRESETS, presetSlugToId, resolvePreset } from '@/lib/clips/caption-presets'
import type { ScriptEditorSettings } from '@/lib/clips/script-edl/types'
import { cn } from '@/lib/utils'

export function ScriptCaptionsPanel({
  settings,
  onPatch,
}: {
  settings: ScriptEditorSettings
  onPatch: (patch: Partial<ScriptEditorSettings>) => void
}) {
  const cap = settings.captions ?? {}
  const presetId = cap.presetId || 'bold_pop'
  const preset = resolvePreset(presetId)

  const patchCaptions = (partial: NonNullable<ScriptEditorSettings['captions']>) => {
    onPatch({ captions: { ...cap, ...partial }, captionsEnabled: settings.captionsEnabled !== false })
  }

  return (
    <div className="flex flex-col gap-3 p-3" data-testid="script-captions-panel">
      <p className="text-sm font-medium">Caption style</p>
      <div className="grid grid-cols-2 gap-2">
        {CAPTION_PRESETS.map((p) => {
          const id = presetSlugToId(p.slug)
          const active = id === presetId
          return (
            <button
              key={p.slug}
              type="button"
              onClick={() =>
                patchCaptions({
                  presetId: id,
                  animation: p.animation,
                  size: p.sizePct,
                  position: p.position,
                  case: p.case,
                  wordsPerLine: p.wordsPerLine,
                })
              }
              className={cn(
                'rounded-lg border p-2 text-left transition-colors',
                active ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:bg-muted/40',
              )}
            >
              <p className="mb-1 text-xs font-medium">{p.name}</p>
              <CaptionMiniPreview preset={p} />
            </button>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Active: {preset.name} · {cap.animation || preset.animation} · {cap.wordsPerLine ?? preset.wordsPerLine} words/line
      </p>
    </div>
  )
}

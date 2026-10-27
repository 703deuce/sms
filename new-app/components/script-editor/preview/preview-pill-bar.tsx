'use client'

import type { ScriptAspect, ScriptEditorSettings, ScriptReframeMode } from '@/lib/clips/script-edl/types'
import { cn } from '@/lib/utils'

const ASPECTS: ScriptAspect[] = ['9:16', '1:1', '4:5', '16:9']

const REFRAME_LABEL: Record<ScriptReframeMode, string> = {
  speaker_follow: 'Auto',
  center_crop: 'Center',
  manual: 'Manual',
}

export function PreviewPillBar({
  settings,
  onPatch,
}: {
  settings: ScriptEditorSettings
  onPatch: (patch: Partial<ScriptEditorSettings>) => void
}) {
  const aspect = settings.aspect ?? '9:16'
  const reframe = settings.reframeMode ?? 'speaker_follow'

  return (
    <div
      className="pointer-events-auto absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-full border border-border/80 bg-background/90 px-2 py-1 shadow-md backdrop-blur-sm"
      data-testid="preview-pill-bar"
    >
      {ASPECTS.map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => onPatch({ aspect: a })}
          className={cn(
            'rounded-full px-2 py-0.5 text-[11px] font-medium',
            aspect === a ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
          )}
        >
          {a}
        </button>
      ))}
      <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
      <button
        type="button"
        onClick={() =>
          onPatch({
            reframeMode:
              reframe === 'speaker_follow' ? 'center_crop' : reframe === 'center_crop' ? 'manual' : 'speaker_follow',
          })
        }
        className="rounded-full px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted"
        title="Cycle reframe mode"
      >
        Reframe {REFRAME_LABEL[reframe]}
      </button>
      <button
        type="button"
        onClick={() => onPatch({ captionsEnabled: settings.captionsEnabled === false })}
        className={cn(
          'rounded-full px-2 py-0.5 text-[11px] font-medium',
          settings.captionsEnabled !== false ? 'bg-sky-500/20 text-sky-900 dark:text-sky-100' : 'text-muted-foreground',
        )}
      >
        CC {settings.captionsEnabled !== false ? 'On' : 'Off'}
      </button>
    </div>
  )
}

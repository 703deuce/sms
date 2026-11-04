'use client'

import { Button } from '@/components/ui/button'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { clipEditorAiExtrasEnabled } from '@/lib/clips/clip-editor-feature-flags'
import {
  EXPORT_LAYOUT_OPTIONS,
  layoutOptionDisabled,
  layoutPickPayload,
  type LayoutOptionId,
} from '@/lib/clips/layout-options'
import type { FacecamLayoutState } from '@/lib/server/clips/clip-detail'
import { isLandscapeAspect } from '@/lib/clips/export-aspect'

/** EFFECTS1: on 16:9 the export renders only these layouts differently (worker landscape_layout). */
const LANDSCAPE_ACTIVE = new Set<string>(['full_frame', 'center_crop'])
const LANDSCAPE_HINT = 'Vertical layouts: on a 16:9 project this looks the same as Full frame. Change Aspect to 9:16 or 1:1 to use it.'

export function LayoutQuickPicker({
  value,
  edits,
  facecamLayout = null,
  reframeV2Enabled = false,
  onPick,
  className,
}: {
  value: ClipEditsV2['layout']['mode']
  edits: ClipEditsV2
  facecamLayout?: FacecamLayoutState | null
  reframeV2Enabled?: boolean
  onPick: (mode: LayoutOptionId, facecam?: ClipEditsV2['layout']['facecam']) => void
  className?: string
}) {
  const aiExtras = clipEditorAiExtrasEnabled()
  const ctx = { facecamLayout, reframeV2Enabled, aiExtras }
  const landscape = isLandscapeAspect(edits.aspectRatio ?? '9:16')
  const composite = Boolean(edits.sourceSegments?.length)
  const shown = landscape && !LANDSCAPE_ACTIVE.has(value) ? 'full_frame' : value
  return (
    <div className={className} data-testid="layout-quick-picker">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">Layout</p>
      <div className="flex flex-wrap gap-1.5">
        {EXPORT_LAYOUT_OPTIONS.map((opt) => {
          const landscapeOff = landscape && !LANDSCAPE_ACTIVE.has(opt.id)
          const disabled = layoutOptionDisabled(opt, ctx) || landscapeOff || composite
          const selected = shown === opt.id && !disabled
          return (
            <Button
              key={opt.id}
              type="button"
              size="sm"
              variant={selected ? 'default' : 'outline'}
              disabled={disabled}
              title={
                composite
                  ? 'Multi-source clip: each source keeps its own framing (set it per segment on the timeline).'
                  : landscapeOff
                    ? LANDSCAPE_HINT
                    : disabled && opt.needsFacecam ? 'No facecam detected for this clip' : opt.hint
              }
              onClick={() => {
                if (disabled) return
                const payload = layoutPickPayload(opt.id, facecamLayout, edits)
                onPick(payload.mode, payload.facecam)
              }}
            >
              {opt.title}
              {opt.beta ? (
                <span className="ml-1 rounded bg-muted px-1 py-0 text-[11px] font-normal uppercase text-muted-foreground">
                  Beta
                </span>
              ) : null}
            </Button>
          )
        })}
      </div>
      {landscape ? (
        <p className="mt-1 text-[11px] text-muted-foreground" data-testid="layout-landscape-hint">
          16:9 project: greyed layouts only change vertical (9:16) or square exports. Change Aspect to use them.
        </p>
      ) : null}
      {!facecamLayout?.facecam &&
      !edits.layout.facecam?.box &&
      EXPORT_LAYOUT_OPTIONS.some((o) => o.needsFacecam) ? (
        <p className="mt-1 text-[11px] text-muted-foreground">No facecam detected for this clip</p>
      ) : null}
    </div>
  )
}

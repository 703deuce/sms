'use client'

import { Button } from '@/components/ui/button'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { clipEditorAiExtrasEnabled } from '@/lib/clips/clip-editor-feature-flags'
import {
  EXPORT_LAYOUT_OPTIONS,
  exportLayoutHint,
  layoutOptionDisabled,
  layoutPickPayload,
  type LayoutOptionId,
} from '@/lib/clips/layout-options'
import { isLandscapeAspect } from '@/lib/clips/export-aspect'
import { landscapeLayoutVisible } from '@/lib/clips/editor/landscape-layouts'

export function ExportLayoutPicker({
  value,
  onChange,
  facecamLayout = null,
  edits,
  reframeV2Enabled = false,
}: {
  value: ClipEditsV2['layout']['mode']
  onChange: (mode: ClipEditsV2['layout']['mode'], facecam?: ClipEditsV2['layout']['facecam']) => void
  facecamLayout?: FacecamLayoutState | null
  edits: ClipEditsV2
  reframeV2Enabled?: boolean
}) {
  const aiExtras = clipEditorAiExtrasEnabled()
  const ctx = { facecamLayout, reframeV2Enabled, aiExtras }
  const landscape = isLandscapeAspect(edits.aspectRatio ?? '9:16')
  const options = EXPORT_LAYOUT_OPTIONS.filter((o) => !landscape || landscapeLayoutVisible(o.id))
  return (
    <div className="mt-3 space-y-1" data-testid="export-layout-picker">
      <p className="text-xs font-medium">Layout for this export</p>
      <p className="text-xs text-muted-foreground" data-testid="export-layout-hint">
        {exportLayoutHint(value)}
      </p>
      {!facecamLayout?.facecam && !edits.layout.facecam?.box ? (
        <p className="text-[10px] text-muted-foreground">No facecam detected for this clip</p>
      ) : null}
      <div className="mt-1 flex flex-wrap gap-2">
        {options.map((opt) => {
          const disabled = layoutOptionDisabled(opt, ctx)
          const selected = value === opt.id && !disabled
          return (
            <Button
              key={opt.id}
              type="button"
              size="sm"
              variant={selected ? 'default' : 'outline'}
              disabled={disabled}
              title={disabled && opt.needsFacecam ? 'No facecam detected for this clip' : opt.hint}
              onClick={() => {
                if (disabled) return
                const payload = layoutPickPayload(opt.id, facecamLayout, edits)
                onChange(payload.mode, payload.facecam)
              }}
            >
              {opt.title}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

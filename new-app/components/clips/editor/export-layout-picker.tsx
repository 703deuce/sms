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
  return (
    <div className="mt-3 space-y-1" data-testid="export-layout-picker">
      <p className="text-xs font-medium">Layout for this export</p>
      <p className="text-xs text-muted-foreground">
        Full frame keeps the entire stream shot with blurred sides and space for the headline bar.
      </p>
      {!facecamLayout?.facecam && !edits.layout.facecam?.box ? (
        <p className="text-[10px] text-muted-foreground">No facecam detected for this clip</p>
      ) : null}
      <div className="mt-1 flex flex-wrap gap-2">
        {EXPORT_LAYOUT_OPTIONS.map((opt) => {
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

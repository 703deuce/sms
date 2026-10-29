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
  return (
    <div className={className} data-testid="layout-quick-picker">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">Layout</p>
      <div className="flex flex-wrap gap-1.5">
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
                onPick(payload.mode, payload.facecam)
              }}
            >
              {opt.title}
            </Button>
          )
        })}
      </div>
      {!facecamLayout?.facecam &&
      EXPORT_LAYOUT_OPTIONS.some((o) => o.needsFacecam) ? (
        <p className="mt-1 text-[10px] text-muted-foreground">No facecam detected for this clip</p>
      ) : null}
    </div>
  )
}

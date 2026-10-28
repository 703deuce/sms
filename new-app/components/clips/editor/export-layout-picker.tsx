'use client'

import { Button } from '@/components/ui/button'
import type { ClipEditsV2 } from '@/lib/clips/edits'

const EXPORT_LAYOUT_OPTIONS: {
  id: ClipEditsV2['layout']['mode']
  label: string
  hint: string
}[] = [
  { id: 'speaker_follow', label: 'Speaker follow', hint: 'Active speaker crop' },
  { id: 'full_frame', label: 'Full frame', hint: 'Whole 16:9, blur fill, headline room' },
  { id: 'fit_blur', label: 'Fit + blur', hint: 'Letterbox, no headline band' },
  { id: 'fit_top', label: 'Headline top', hint: 'White headline band + full-width video (stream default)' },
  { id: 'center_crop', label: 'Fill crop', hint: 'Edge-to-edge crop' },
]

export function ExportLayoutPicker({
  value,
  onChange,
}: {
  value: ClipEditsV2['layout']['mode']
  onChange: (mode: ClipEditsV2['layout']['mode']) => void
}) {
  return (
    <div className="mt-3 space-y-1">
      <p className="text-xs font-medium">Layout for this export</p>
      <p className="text-xs text-muted-foreground">
        Full frame keeps the entire stream shot with blurred sides and space for the headline bar.
      </p>
      <div className="mt-1 flex flex-wrap gap-2">
        {EXPORT_LAYOUT_OPTIONS.map((opt) => (
          <Button
            key={opt.id}
            type="button"
            size="sm"
            variant={value === opt.id ? 'default' : 'outline'}
            onClick={() => onChange(opt.id)}
            title={opt.hint}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

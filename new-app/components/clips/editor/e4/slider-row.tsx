'use client'

import { useEffect, useState } from 'react'
import { Slider } from '@/components/ui/slider'

/**
 * Design-system slider row (no native range — tests/editor-native-controls). Drags update `onLive`
 * (preview only); release commits once (one undo step).
 */
export function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onLive,
  onCommit,
  testId,
  disabled,
  format,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onLive?: (v: number) => void
  onCommit: (v: number) => void
  testId: string
  disabled?: boolean
  /** Display text for the value (default: rounded value + unit). */
  format?: (v: number) => string
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const num = (v: number | readonly number[]) => (Array.isArray(v) ? v[0] : v) as number
  return (
    <div className="space-y-1" data-testid={`${testId}-row`}>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <button
          type="button"
          className="tabular-nums text-muted-foreground hover:text-foreground"
          title="Reset"
          disabled={disabled}
          onClick={() => onCommit(min <= 0 && max >= 0 ? 0 : min)}
          data-testid={`${testId}-value`}
        >
          {format ? format(draft) : `${Math.round(draft * 100) / 100}${unit}`}
        </button>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[draft]}
        disabled={disabled}
        onValueChange={(v) => {
          const n = num(v)
          if (typeof n === 'number') {
            setDraft(n)
            onLive?.(n)
          }
        }}
        onValueCommitted={(v) => {
          const n = num(v)
          if (typeof n === 'number') onCommit(n)
        }}
        aria-label={label}
        data-testid={testId}
      />
    </div>
  )
}

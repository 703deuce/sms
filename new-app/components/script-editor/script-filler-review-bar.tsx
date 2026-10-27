'use client'

import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { FillerFilter } from '@/lib/clips/script-editor/filler-hits'

export type FillerReviewAction = 'delete' | 'ignore'

export function ScriptFillerReviewBar({
  total,
  cursor,
  filter,
  onFilterChange,
  selectionOnly,
  onSelectionOnlyChange,
  avoidHarshCuts,
  onAvoidHarshCutsChange,
  onPrev,
  onNext,
  onRemoveOne,
  onRemoveAll,
  onClose,
}: {
  total: number
  cursor: number
  filter: FillerFilter
  onFilterChange: (f: FillerFilter) => void
  selectionOnly: boolean
  onSelectionOnlyChange: (v: boolean) => void
  avoidHarshCuts: boolean
  onAvoidHarshCutsChange: (v: boolean) => void
  onPrev: () => void
  onNext: () => void
  onRemoveOne: () => void
  onRemoveAll: () => void
  onClose: () => void
}) {
  const pos = total > 0 ? cursor + 1 : 0
  const filterLabel =
    filter === 'all' ? 'All filler words' : filter === 'lexicon' ? 'Lexicon fillers' : 'Repeated words'

  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-2 border-b border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs"
      data-testid="script-filler-review-bar"
    >
      <Select value={filter} onValueChange={(v) => typeof v === 'string' && onFilterChange(v as FillerFilter)}>
        <SelectTrigger className="h-8 w-[11rem] text-xs">
          <SelectValue>{filterLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All filler words</SelectItem>
          <SelectItem value="lexicon">Lexicon (um, uh, like…)</SelectItem>
          <SelectItem value="repeat">Repeated words</SelectItem>
        </SelectContent>
      </Select>
      <span className="tabular-nums text-muted-foreground">{pos}/{total}</span>
      <Button type="button" size="icon-sm" variant="ghost" disabled={total === 0} onClick={onPrev} aria-label="Previous filler">
        <ChevronUp className="size-4" />
      </Button>
      <Button type="button" size="icon-sm" variant="ghost" disabled={total === 0} onClick={onNext} aria-label="Next filler">
        <ChevronDown className="size-4" />
      </Button>
      <label className="flex items-center gap-1.5">
        <Switch checked={selectionOnly} onCheckedChange={onSelectionOnlyChange} />
        Selection only
      </label>
      <label className="flex items-center gap-1.5">
        <Switch checked={avoidHarshCuts} onCheckedChange={onAvoidHarshCutsChange} />
        Avoid harsh cuts
      </label>
      <div className="ml-auto flex items-center gap-2">
        <Button type="button" size="sm" variant="secondary" disabled={total === 0} onClick={onRemoveOne}>
          Remove
        </Button>
        <Button type="button" size="sm" disabled={total === 0} onClick={onRemoveAll}>
          Remove all
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close filler review">
          <X className="size-4" />
        </Button>
      </div>
    </div>
  )
}

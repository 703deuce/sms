'use client'

import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { FillerFilter } from '@/lib/clips/script-editor/filler-hits'

export type FillerReviewAction = 'delete' | 'replace_with_gap' | 'ignore' | 'hide_transcript'

const ACTION_LABEL: Record<FillerReviewAction, string> = {
  delete: 'Delete',
  replace_with_gap: 'Delete and replace with gap',
  ignore: 'Ignore',
  hide_transcript: 'Remove from transcript only',
}

export function ScriptFillerReviewBar({
  mode,
  total,
  cursor,
  filter,
  action,
  onActionChange,
  onFilterChange,
  selectionOnly,
  onSelectionOnlyChange,
  avoidHarshCuts,
  onAvoidHarshCutsChange,
  autoAdvance,
  onAutoAdvanceChange,
  onPrev,
  onNext,
  onRemoveOne,
  onRemoveAll,
  onRemoveAllLexicon,
  onRemoveAllRepeat,
  onClose,
}: {
  mode: 'filler' | 'gap'
  total: number
  cursor: number
  filter: FillerFilter
  action: FillerReviewAction
  onActionChange: (a: FillerReviewAction) => void
  onFilterChange: (f: FillerFilter) => void
  selectionOnly: boolean
  onSelectionOnlyChange: (v: boolean) => void
  avoidHarshCuts: boolean
  onAvoidHarshCutsChange: (v: boolean) => void
  autoAdvance: boolean
  onAutoAdvanceChange: (v: boolean) => void
  onPrev: () => void
  onNext: () => void
  onRemoveOne: () => void
  onRemoveAll: () => void
  onRemoveAllLexicon?: () => void
  onRemoveAllRepeat?: () => void
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
      {mode === 'filler' ? (
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
      ) : (
        <span className="font-medium text-amber-900 dark:text-amber-100">Shorten gaps</span>
      )}
      {mode === 'filler' && (
        <Select value={action} onValueChange={(v) => typeof v === 'string' && onActionChange(v as FillerReviewAction)}>
          <SelectTrigger className="h-8 w-[12rem] text-xs">
            <SelectValue>{ACTION_LABEL[action]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ACTION_LABEL) as FillerReviewAction[]).map((k) => (
              <SelectItem key={k} value={k}>{ACTION_LABEL[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <span className="tabular-nums text-muted-foreground">{pos}/{total}</span>
      <Button type="button" size="icon-sm" variant="ghost" disabled={total === 0} onClick={onPrev} aria-label="Previous">
        <ChevronUp className="size-4" />
      </Button>
      <Button type="button" size="icon-sm" variant="ghost" disabled={total === 0} onClick={onNext} aria-label="Next">
        <ChevronDown className="size-4" />
      </Button>
      <label className="flex items-center gap-1.5">
        <Switch checked={selectionOnly} onCheckedChange={onSelectionOnlyChange} />
        Selection only
      </label>
      {mode === 'filler' && (
        <label className="flex items-center gap-1.5">
          <Switch checked={avoidHarshCuts} onCheckedChange={onAvoidHarshCutsChange} />
          Avoid harsh cuts
        </label>
      )}
      <label className="flex items-center gap-1.5">
        <Switch checked={autoAdvance} onCheckedChange={onAutoAdvanceChange} />
        Auto-advance
      </label>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        {mode === 'filler' && onRemoveAllLexicon && (
          <Button type="button" size="sm" variant="outline" disabled={total === 0} onClick={onRemoveAllLexicon}>
            All lexicon
          </Button>
        )}
        {mode === 'filler' && onRemoveAllRepeat && (
          <Button type="button" size="sm" variant="outline" disabled={total === 0} onClick={onRemoveAllRepeat}>
            All repeats
          </Button>
        )}
        <Button type="button" size="sm" variant="secondary" disabled={total === 0} onClick={onRemoveOne}>
          {mode === 'gap' ? 'Shorten' : 'Remove'}
        </Button>
        <Button type="button" size="sm" disabled={total === 0} onClick={onRemoveAll}>
          {mode === 'gap' ? 'Shorten all' : 'Remove all'}
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close review">
          <X className="size-4" />
        </Button>
      </div>
    </div>
  )
}

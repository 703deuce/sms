'use client'

import { ChevronDown, ChevronUp, Search, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { FillerFilter } from '@/lib/clips/script-editor/filler-hits'

export type FillerReviewAction = 'delete' | 'replace_with_gap' | 'ignore' | 'hide_transcript'

export type FillerSearchMode = 'find' | 'filler' | 'gaps'

export type FillerSearchOptions = {
  autoAdvance: boolean
  previewResults: boolean
  matchWholeWords: boolean
  matchCase: boolean
  wrapAround: boolean
  onlyCurrentComposition: boolean
}

const ACTION_LABEL: Record<FillerReviewAction, string> = {
  delete: 'Delete',
  replace_with_gap: 'Delete and replace with gap',
  ignore: 'Ignore',
  hide_transcript: 'Remove from transcript only',
}

const SEARCH_MODE_LABEL: Record<FillerSearchMode, string> = {
  find: 'Find',
  filler: 'Remove filler words',
  gaps: 'Shorten word gaps',
}

export function ScriptFillerReviewBar({
  mode,
  searchMode,
  onSearchModeChange,
  searchQuery,
  onSearchQueryChange,
  searchOptions,
  onSearchOptionsChange,
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
  targetGapSec,
  onTargetGapSecChange,
  onPrev,
  onNext,
  onRemoveOne,
  onRemoveAll,
  onRemoveAllLexicon,
  onRemoveAllRepeat,
  replaceText,
  onReplaceTextChange,
  onReplaceOne,
  onReplaceAll,
  onFindNext,
  onFindPrev,
  onClose,
  variant = 'default',
  onSkipOne,
}: {
  mode: 'filler' | 'gap'
  variant?: 'default' | 'clip'
  onSkipOne?: () => void
  searchMode: FillerSearchMode
  onSearchModeChange: (m: FillerSearchMode) => void
  searchQuery: string
  onSearchQueryChange: (q: string) => void
  searchOptions: FillerSearchOptions
  onSearchOptionsChange: (patch: Partial<FillerSearchOptions>) => void
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
  targetGapSec: number
  onTargetGapSecChange: (n: number) => void
  onPrev: () => void
  onNext: () => void
  onRemoveOne: () => void
  onRemoveAll: () => void
  onRemoveAllLexicon?: () => void
  onRemoveAllRepeat?: () => void
  replaceText?: string
  onReplaceTextChange?: (v: string) => void
  onReplaceOne?: () => void
  onReplaceAll?: () => void
  onFindNext?: () => void
  onFindPrev?: () => void
  onClose: () => void
}) {
  const pos = total > 0 ? cursor + 1 : 0
  const filterLabel =
    filter === 'all' ? 'All filler words' : filter === 'lexicon' ? 'Lexicon fillers' : 'Repeated words'
  const queryPlaceholder =
    mode === 'gap' ? 'Gaps more than 3s' : searchMode === 'find' ? 'Search transcript…' : filterLabel

  return (
    <div
      className="flex shrink-0 flex-col gap-0 border-b border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs shadow-sm"
      data-testid="script-filler-review-bar"
    >
      <div className="flex flex-wrap items-center gap-2 py-1">
        {variant === 'clip' ? (
          <span className="inline-flex h-8 items-center gap-1.5 px-1 text-xs font-medium" data-testid="filler-search-mode">
            <Search className="size-3.5 shrink-0 opacity-70" aria-hidden />
            {mode === 'gap' ? 'Review pauses' : 'Review filler words'}
          </span>
        ) : (
          <Select
            value={searchMode}
            onValueChange={(v) => typeof v === 'string' && onSearchModeChange(v as FillerSearchMode)}
          >
            <SelectTrigger className="h-8 w-[10.5rem] text-xs" data-testid="filler-search-mode">
              <Search className="mr-1 size-3.5 shrink-0 opacity-70" aria-hidden />
              <SelectValue>{SEARCH_MODE_LABEL[searchMode]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="find">Find (⌘F)</SelectItem>
              <SelectItem value="filler">Remove filler words</SelectItem>
              <SelectItem value="gaps">Shorten word gaps</SelectItem>
            </SelectContent>
          </Select>
        )}
        {mode === 'filler' && searchMode === 'filler' && variant !== 'clip' ? (
          <Select value={filter} onValueChange={(v) => typeof v === 'string' && onFilterChange(v as FillerFilter)}>
            <SelectTrigger className="h-8 min-w-[11rem] flex-1 text-xs">
              <SelectValue>{filterLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All filler words</SelectItem>
              <SelectItem value="lexicon">Lexicon (um, uh, like…)</SelectItem>
              <SelectItem value="repeat">Repeated words</SelectItem>
            </SelectContent>
          </Select>
        ) : variant === 'clip' ? (
          <span className="min-w-[8rem] flex-1 text-muted-foreground">Step through each hit</span>
        ) : (
          <Input
            className="h-8 min-w-[8rem] flex-1 text-xs"
            value={searchQuery}
            placeholder={queryPlaceholder}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onFindNext?.()
              }
              if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault()
                onFindPrev?.()
              }
            }}
            data-testid="filler-search-query"
          />
        )}
        <span className="w-12 tabular-nums text-right text-muted-foreground" data-testid="filler-match-count">
          {pos}/{total}
        </span>
        <Button type="button" size="icon-sm" variant="ghost" disabled={total === 0} onClick={onPrev} aria-label="Previous">
          <ChevronUp className="size-4" />
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" disabled={total === 0} onClick={onNext} aria-label="Next">
          <ChevronDown className="size-4" />
        </Button>
        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Search options"
                data-testid="filler-search-options"
              >
                <SlidersHorizontal className="size-4" />
              </Button>
            }
          />
          <PopoverContent className="w-60 p-2" align="start" data-testid="filler-search-options-panel">
            <p className="mb-2 px-1 text-[11px] font-medium text-muted-foreground">Search options</p>
            {(
              [
                ['autoAdvance', 'Auto-advance'],
                ['previewResults', 'Preview results'],
                ['matchWholeWords', 'Match whole words'],
                ['matchCase', 'Match case'],
                ['wrapAround', 'Wrap around'],
                ['onlyCurrentComposition', 'Only current composition'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex h-8 cursor-pointer items-center justify-between gap-2 rounded px-1 hover:bg-muted/50">
                <span>{label}</span>
                <Switch
                  checked={searchOptions[key]}
                  onCheckedChange={(v) => onSearchOptionsChange({ [key]: v })}
                />
              </label>
            ))}
          </PopoverContent>
        </Popover>
        <Button type="button" size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close review">
          <X className="size-4" />
        </Button>
      </div>
      {searchMode === 'find' && (
        <div className="flex flex-wrap items-center gap-2 border-t border-sky-500/20 py-1.5">
          <Input
            className="h-8 min-w-[8rem] flex-1 text-xs"
            value={replaceText ?? ''}
            placeholder="Replace with…"
            onChange={(e) => onReplaceTextChange?.(e.target.value)}
            data-testid="find-replace-with"
          />
          <Button type="button" size="sm" variant="secondary" disabled={total === 0} onClick={onReplaceOne}>
            Replace
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={total === 0} onClick={onReplaceAll}>
            Replace all
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-sky-500/20 py-1.5">
        {mode === 'filler' && searchMode !== 'find' && variant !== 'clip' ? (
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
        ) : mode === 'gap' || searchMode === 'gaps' ? (
          <label className="flex items-center gap-2 text-xs">
            Shorten to
            <Input
              type="number"
              step={0.1}
              min={0.1}
              className="h-8 w-16"
              value={targetGapSec}
              onChange={(e) => onTargetGapSecChange(Number(e.target.value) || 0.3)}
              data-testid="filler-gap-target-sec"
            />
            s
          </label>
        ) : null}
        {variant !== 'clip' ? (
          <label className="flex items-center gap-1.5">
            <Switch checked={selectionOnly} onCheckedChange={onSelectionOnlyChange} />
            Selection only
          </label>
        ) : null}
        {mode === 'filler' && variant !== 'clip' && (
          <label className="flex items-center gap-1.5" title="Keeps filler words if cutting them would sound unnatural">
            <Switch checked={avoidHarshCuts} onCheckedChange={onAvoidHarshCutsChange} />
            Avoid harsh cuts
          </label>
        )}
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
          {variant === 'clip' && onSkipOne ? (
            <Button type="button" size="sm" variant="outline" disabled={total === 0} onClick={onSkipOne}>
              Skip
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="secondary" disabled={total === 0} onClick={onRemoveOne}>
            {mode === 'gap' ? 'Shorten' : variant === 'clip' ? 'Approve' : 'Remove'}
          </Button>
          <Button type="button" size="sm" disabled={total === 0} onClick={onRemoveAll}>
            {mode === 'gap' ? 'Shorten all' : variant === 'clip' ? 'Approve all' : 'Remove all'}
          </Button>
        </div>
      </div>
      {total === 0 && (
        <p className="pb-1 text-[11px] text-muted-foreground" data-testid="filler-zero-hits">
          {mode === 'gap'
            ? 'No gaps match'
            : searchMode === 'find'
              ? 'No matches'
              : 'No filler words found'}
        </p>
      )}
    </div>
  )
}

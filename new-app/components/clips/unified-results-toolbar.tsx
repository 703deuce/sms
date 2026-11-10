import type { UnifiedClipSort, UnifiedClipTypeFilter } from '../../lib/clips/unified-clip-results'

const TYPE_OPTIONS: { id: UnifiedClipTypeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'story', label: 'Story' },
  { id: 'continuous', label: 'Continuous' },
]

export function UnifiedResultsToolbar({
  typeFilter,
  sort,
  onTypeFilterChange,
  onSortChange,
  storyCount,
  continuousCount,
}: {
  typeFilter: UnifiedClipTypeFilter
  sort: UnifiedClipSort
  onTypeFilterChange: (next: UnifiedClipTypeFilter) => void
  onSortChange: (next: UnifiedClipSort) => void
  storyCount: number
  continuousCount: number
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid="unified-results-toolbar"
    >
      <div
        className="inline-flex items-center rounded-md border border-border bg-background p-0.5"
        role="group"
        aria-label="Filter clips by type"
      >
        {TYPE_OPTIONS.map((opt) => {
          const count =
            opt.id === 'story' ? storyCount : opt.id === 'continuous' ? continuousCount : storyCount + continuousCount
          const selected = typeFilter === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              data-testid={`unified-filter-${opt.id}`}
              aria-pressed={selected}
              onClick={() => onTypeFilterChange(opt.id)}
              className={`h-7 rounded-md px-2.5 text-xs font-medium transition-colors ${
                selected
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
              <span className="ml-1 tabular-nums text-muted-foreground">{count}</span>
            </button>
          )
        })}
      </div>
      <select
        aria-label="Sort clips"
        data-testid="project-clip-sort"
        className="h-8 rounded-md border border-border bg-background px-2 text-xs"
        value={sort}
        onChange={(e) => onSortChange(e.target.value as UnifiedClipSort)}
      >
        <option value="score">Score</option>
        <option value="type">Type</option>
        <option value="duration">Duration</option>
        <option value="timeline">Timeline</option>
        <option value="title">Title</option>
      </select>
    </div>
  )
}

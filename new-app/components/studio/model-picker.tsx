'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import type { StudioModel } from '../../lib/ai-studio/contract'
import { modelVisual } from '../../lib/ai-studio/catalog'
import { formatCredits, kindLabel, modelOptionSummary } from '../../lib/ai-studio/format'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { cn } from '../../lib/utils'

export function ModelPicker({
  open,
  onOpenChange,
  models,
  selectedId,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  models: StudioModel[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const match = (m: StudioModel) =>
      !q || m.label.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
    const video = models.filter((m) => m.kind === 'video' && match(m))
    const image = models.filter((m) => m.kind === 'image' && match(m))
    return { video, image, flat: [...video, ...image] }
  }, [models, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      const i = filtered.flat.findIndex((m) => m.id === selectedId)
      setActive(i >= 0 ? i : 0)
    }
  }, [open, selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setActive((i) => Math.min(i, Math.max(0, filtered.flat.length - 1)))
  }, [filtered.flat.length])

  function choose(id: string) {
    onSelect(id)
    onOpenChange(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, filtered.flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const m = filtered.flat[active]
      if (m) choose(m.id)
    }
  }

  const groups: { label: string; items: StudioModel[] }[] = [
    { label: 'Video', items: filtered.video },
    { label: 'Image', items: filtered.image },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-3 p-0 sm:max-w-md" showCloseButton data-testid="studio-model-picker">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>Choose a model</DialogTitle>
          <DialogDescription>Search the studio registry. Options come from the model, not a fixed list.</DialogDescription>
        </DialogHeader>
        <div className="px-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search models"
              aria-label="Search models"
              className="pl-8"
            />
          </div>
        </div>
        <div ref={listRef} role="listbox" aria-label="Models" className="max-h-80 overflow-y-auto px-2 pb-3">
          {filtered.flat.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">No models match that search.</p>
          ) : (
            groups.map((g) =>
              g.items.length ? (
                <div key={g.label} className="mb-2">
                  <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{g.label}</p>
                  {g.items.map((m) => {
                    const i = filtered.flat.indexOf(m)
                    const selected = m.id === selectedId
                    return (
                      <button
                        key={m.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        data-active={i === active}
                        className={cn(
                          'flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors',
                          'hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                          i === active && 'bg-muted',
                        )}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => choose(m.id)}
                      >
                        <div
                          className="size-9 shrink-0 rounded-md ring-1 ring-inset ring-white/10"
                          style={{ background: modelVisual(m).art }}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-sm font-medium text-foreground">{m.label}</span>
                            <Badge variant="secondary">{kindLabel(m.kind)}</Badge>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {modelOptionSummary(m) || m.id}
                            {' · '}from {formatCredits(m.creditEstimate)}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : null,
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function ModelCard({
  model,
  onChange,
}: {
  model: StudioModel | null
  onChange: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3" data-testid="studio-model-card">
      <div
        className="size-11 shrink-0 rounded-lg ring-1 ring-inset ring-white/10"
        style={{ background: model ? modelVisual(model).art : undefined }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{model?.label ?? 'No model'}</p>
        <p className="truncate text-xs text-muted-foreground">
          {model
            ? `${modelOptionSummary(model) || kindLabel(model.kind)} · from ${formatCredits(model.creditEstimate)}`
            : 'Models are still loading'}
        </p>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={onChange} disabled={!model}>
        Change
      </Button>
    </div>
  )
}

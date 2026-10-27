'use client'

import { ChevronDown, ChevronUp, Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { ClipProjectListItem } from '@/lib/clips/project-list-item'
import { Button } from '@/components/ui/button'

function isProcessing(status: string) {
  return status !== 'READY' && status !== 'FAILED' && status !== 'CANCELED' && status !== 'DRAFT'
}

export function DriveActivityCard({ projects }: { projects: ClipProjectListItem[] }) {
  const [open, setOpen] = useState(true)
  const active = projects.filter((p) => isProcessing(p.status))

  if (!active.length) return null

  return (
    <div
      className="fixed bottom-6 right-6 z-40 w-[288px] rounded-xl border border-border bg-card shadow-lg"
      data-testid="drive-activity-card"
    >
      <button
        type="button"
        className="flex h-10 w-full items-center justify-between px-3 text-[13px] font-semibold"
        onClick={() => setOpen((o) => !o)}
      >
        Activity
        {open ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
      </button>
      {open && (
        <ul className="border-t border-border">
          {active.map((p) => (
            <li key={p.id} className="group relative flex h-10 items-center gap-2 px-3 text-xs">
              <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
              <span className="flex-1 truncate font-medium">
                {p.stage === 'transcribing' ? 'Transcribing' : 'Processing'} {p.title}
              </span>
              <span className="font-mono text-muted-foreground tabular-nums">{p.progress}%</span>
              <div className="absolute inset-x-0 bottom-0 h-0.5 bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${p.progress}%` }} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="opacity-0 group-hover:opacity-100"
                aria-label="Dismiss"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

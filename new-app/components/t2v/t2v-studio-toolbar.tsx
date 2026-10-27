'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScriptExportPopover } from '@/components/script-editor/script-export-popover'

type Props = {
  projectId: string
  title: string
  mode: 'script' | 'storyboard'
  compositionId: string | null
  durationMs: number
  aspect: string
  projectStatus: string
  storyboardStale: boolean
}

export function T2vStudioToolbar({
  projectId,
  title,
  mode,
  compositionId,
  durationMs,
  aspect,
  projectStatus,
  storyboardStale,
}: Props) {
  const [exportOpen, setExportOpen] = useState(false)

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-3 text-sm">
          <Link href="/app/clips" className="text-muted-foreground hover:text-foreground">← Drive</Link>
          <span className="font-medium">{title}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            href={`/app/clips/${projectId}/video?mode=script`}
            className={mode === 'script' ? 'font-medium text-foreground' : 'text-muted-foreground'}
          >
            Script
          </Link>
          <Link
            href={`/app/clips/${projectId}/video?mode=storyboard`}
            className={mode === 'storyboard' ? 'font-medium text-foreground' : 'text-muted-foreground'}
          >
            Storyboard
          </Link>
          <Link href={`/app/clips/${projectId}/script`} className="text-primary">
            Open in editor
          </Link>
          {compositionId ? (
            <Button
              type="button"
              size="sm"
              variant="default"
              disabled={projectStatus !== 'READY' && projectStatus !== 'DRAFT'}
              onClick={() => setExportOpen(true)}
              data-testid="t2v-export-trigger"
            >
              Export
              <ChevronDown className="ml-1 size-4" aria-hidden />
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" disabled title="Build the video first">
              Export
            </Button>
          )}
        </div>
      </div>
      {storyboardStale && compositionId ? (
        <p className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-900 dark:text-amber-100">
          Storyboard has unbuilt changes — build again before exporting for the latest edit.
        </p>
      ) : null}
      {compositionId ? (
        <ScriptExportPopover
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          compositionId={compositionId}
          title={title}
          durationMs={durationMs}
          aspect={aspect}
          projectStatus={projectStatus}
        />
      ) : null}
    </>
  )
}

export function T2vStudioBuildingBanner({ progress }: { progress: number }) {
  return (
    <p className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
      <Loader2 className="size-3.5 animate-spin" aria-hidden />
      Building video… {progress > 0 ? `${progress}%` : ''}
    </p>
  )
}

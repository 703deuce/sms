'use client'

import Link from 'next/link'

export function StreamerLayoutPill({
  projectId,
  layout,
}: {
  projectId: string
  layout: Record<string, unknown> | null
}) {
  const l = layout as { layout?: string; confidence?: number; source?: string } | null
  const label =
    l?.layout === 'stack'
      ? `Facecam + gameplay (${l.source === 'manual' ? 'preset' : 'auto'}${l.confidence != null ? `, ${Math.round(l.confidence * 100)}%` : ''})`
      : l?.layout === 'gameplay'
        ? 'Gameplay only'
        : 'Layout: auto'
  return (
    <Link
      href={`/app/clips/${projectId}`}
      className="inline-flex rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
      title="Per-clip layout is edited in each clip's Layout panel"
    >
      {label} · edit per clip
    </Link>
  )
}

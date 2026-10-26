'use client'

import dynamic from 'next/dynamic'
import type { JSONContent } from '@tiptap/core'
import type { FormatSpec } from '@/lib/screenwriting/formats/types'

const ScreenplayWorkspace = dynamic(
  () => import('@/components/screenwriting/screenplay-workspace').then((m) => m.ScreenplayWorkspace),
  { ssr: false, loading: () => <div className="h-[60vh] animate-pulse rounded-lg bg-muted" /> },
)

export function ScreenplayEditorPageClient({
  scriptId,
  scriptTitle,
  formatSpec,
  initialDoc,
  initialMeta,
}: {
  scriptId: string
  scriptTitle: string
  formatSpec: FormatSpec
  initialDoc: JSONContent
  initialMeta?: Record<string, unknown> | null
}) {
  return (
    <ScreenplayWorkspace
      scriptId={scriptId}
      scriptTitle={scriptTitle}
      formatSpec={formatSpec}
      initialDoc={initialDoc}
      initialMeta={initialMeta}
    />
  )
}

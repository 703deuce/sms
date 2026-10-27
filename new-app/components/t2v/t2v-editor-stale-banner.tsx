'use client'

import Link from 'next/link'

export function T2vEditorStaleBanner({ projectId }: { projectId: string }) {
  return (
    <p className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-950 dark:text-amber-100">
      Storyboard has unbuilt changes.{' '}
      <Link href={`/app/clips/${projectId}/video?mode=storyboard`} className="font-medium underline">
        Build in Video studio
      </Link>
    </p>
  )
}

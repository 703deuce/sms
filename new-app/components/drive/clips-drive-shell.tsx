'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect } from 'react'
import { DriveActivityCard } from '@/components/drive/drive-activity-card'
import { DriveTopBar } from '@/components/drive/drive-top-bar'
import { DriveTranscribingDialog } from '@/components/drive/drive-transcribing-dialog'
import { ClipsDriveProvider, useClipsDrive } from '@/components/drive/clips-drive-context'

function isDriveChromeRoute(pathname: string) {
  return (
    pathname === '/app/clips' ||
    pathname === '/app/clips/trash' ||
    pathname === '/app/clips/new' ||
    pathname === '/app/clips/brand' ||
    pathname === '/app/clips/exports'
  )
}

function ClipsDriveShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const params = useSearchParams()
  const showChrome = isDriveChromeRoute(pathname)
  const {
    search,
    setSearch,
    transcribingOpen,
    setTranscribingOpen,
    transcribingTitle,
    syncing,
    setSyncing,
    activityProjects,
  } = useClipsDrive()

  useEffect(() => {
    const q = params.get('q')
    if (q != null) setSearch(q)
  }, [params, setSearch])

  const onSearchSubmit = useCallback(() => {
    const next = new URLSearchParams(params.toString())
    if (search.trim()) next.set('q', search.trim())
    else next.delete('q')
    router.push(`/app/clips?${next.toString()}`)
  }, [params, router, search])

  if (!showChrome) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="clips-drive-shell">
      <div className="flex min-w-0 flex-1 flex-col">
        <DriveTopBar
          searchValue={search}
          onSearchChange={setSearch}
          onSearchSubmit={onSearchSubmit}
          syncing={syncing}
        />
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        <DriveActivityCard projects={activityProjects} />
        <DriveTranscribingDialog
          open={transcribingOpen}
          fileName={transcribingTitle}
          onClose={() => setTranscribingOpen(false)}
        />
      </div>
    </div>
  )
}

export function ClipsDriveShell({ children }: { children: React.ReactNode }) {
  return (
    <ClipsDriveProvider>
      <ClipsDriveShellInner>{children}</ClipsDriveShellInner>
    </ClipsDriveProvider>
  )
}

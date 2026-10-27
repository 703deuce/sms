'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect } from 'react'
import type { ClipProjectListItem } from '@/lib/clips/project-list-item'
import { DriveActivityCard } from '@/components/drive/drive-activity-card'
import { DriveSidebar } from '@/components/drive/drive-sidebar'
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

function ClipsDriveShellInner({
  children,
  projects,
  folders,
}: {
  children: React.ReactNode
  projects: ClipProjectListItem[]
  folders: { id: string; name: string }[]
}) {
  const pathname = usePathname()
  const router = useRouter()
  const params = useSearchParams()
  const showChrome = isDriveChromeRoute(pathname)
  const { search, setSearch, transcribingOpen, setTranscribingOpen, transcribingTitle, syncing, setSyncing } =
    useClipsDrive()

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

  const createFolder = async () => {
    const name = window.prompt('Folder name')
    if (!name?.trim()) return
    setSyncing(true)
    try {
      await fetch('/api/clips/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      router.refresh()
    } finally {
      setSyncing(false)
    }
  }

  if (!showChrome) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-0 flex-1" data-testid="clips-drive-shell">
      <DriveSidebar folders={folders} onNewFolder={() => void createFolder()} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DriveTopBar
          searchValue={search}
          onSearchChange={setSearch}
          onSearchSubmit={onSearchSubmit}
          syncing={syncing}
        />
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        <DriveActivityCard projects={projects} />
        <DriveTranscribingDialog
          open={transcribingOpen}
          fileName={transcribingTitle}
          onClose={() => setTranscribingOpen(false)}
        />
      </div>
    </div>
  )
}

export function ClipsDriveShell({
  children,
  projects,
  folders,
}: {
  children: React.ReactNode
  projects: ClipProjectListItem[]
  folders: { id: string; name: string }[]
}) {
  return (
    <ClipsDriveProvider>
      <ClipsDriveShellInner projects={projects} folders={folders}>{children}</ClipsDriveShellInner>
    </ClipsDriveProvider>
  )
}

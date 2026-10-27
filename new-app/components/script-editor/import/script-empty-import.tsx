'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { FolderOpen, Link2, Mic, Video, Wand2 } from 'lucide-react'
import { PrimaryButton } from '@/components/app/primary-button'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dropzone } from '@/components/clips/dropzone'
import { Input } from '@/components/ui/input'
import { validateImportUrlForSubmit } from '@/lib/clips/import-url'
import { attachMediaToProject } from '@/lib/clips-api'
import { uploadClipFile } from '@/lib/clips/upload'
import { toast } from 'sonner'

export function ScriptEmptyImport({ projectId, projectTitle }: { projectId: string; projectTitle: string }) {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)

  const onLink = async () => {
    const check = validateImportUrlForSubmit(url)
    if (!check.ok) {
      toast.error(check.message)
      return
    }
    setBusy(true)
    try {
      await attachMediaToProject(projectId, { sourceUrl: url.trim() })
      router.push(`/app/clips/${projectId}`)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  const onFile = (file: File) => {
    setBusy(true)
    void uploadClipFile(file, async (p) => {
      if (p.state === 'error') {
        setBusy(false)
        toast.error(p.error ?? 'Upload failed')
        return
      }
      if (p.state === 'complete' && p.uploadId) {
        try {
          await attachMediaToProject(projectId, { uploadId: p.uploadId })
          router.push(`/app/clips/${projectId}`)
          router.refresh()
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Could not attach media')
        } finally {
          setBusy(false)
        }
      }
    }).catch(() => setBusy(false))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto p-8" data-testid="script-empty-import">
      <div className="w-full max-w-[736px] pt-16">
        <h1 className="text-center text-[22px] font-semibold text-muted-foreground">Name your creation</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">{projectTitle || 'Untitled'}</p>

        <PrimaryButton className="mt-6 h-10 w-full" render={<Link href={`/app/clips/new?from=${projectId}`} />}>
          <Wand2 className="size-4" />
          Make clips from a long video
        </PrimaryButton>

        <div className="mt-4 [&_[role=button]]:min-h-[304px] [&_[role=button]]:rounded-xl">
          <Dropzone onFile={onFile} disabled={busy} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Link href="/app/clips" className={buttonVariants({ variant: 'outline', className: 'h-11 justify-start gap-2' })}>
            <FolderOpen className="size-4" />
            Import from media library
          </Link>
          <Link href="/app/rooms/new" className={buttonVariants({ variant: 'outline', className: 'h-11 justify-start gap-2' })}>
            <Video className="size-4" />
            Record
          </Link>
          <div className="col-span-1 flex h-11 items-center gap-2 rounded-lg border border-border px-3 sm:col-span-2">
            <Link2 className="size-4 shrink-0 text-muted-foreground" />
            <Input
              className="h-8 flex-1 border-0 bg-transparent shadow-none"
              placeholder="Import from YouTube or Google Drive link"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <Button type="button" size="sm" disabled={busy} onClick={() => void onLink()}>
              Import
            </Button>
          </div>
          <Link href="/app/rooms" className={buttonVariants({ variant: 'outline', className: 'h-11 justify-start gap-2' })}>
            <Mic className="size-4" />
            Import from Rooms take
          </Link>
        </div>
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { FileVideo, Loader2, Upload } from 'lucide-react'
import { Dropzone } from '@/components/clips/dropzone'
import { ProjectStatusBadge } from '@/components/app/status'
import { Button } from '@/components/ui/button'
import { createProject } from '@/lib/clips-api'
import { defaultClipSettings } from '@/lib/clips/settings'
import { uploadClipFile } from '@/lib/clips/upload'
import type { MediaLibraryUploadRow } from '@/lib/server/clips/media-library'
import { toast } from 'sonner'
import { isScriptEditorEnabled } from '@/lib/features/script-editor'

function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(ms: number | null) {
  if (!ms || ms < 1) return '—'
  const s = Math.round(ms / 1000)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

export function MediaLibraryView({ uploads }: { uploads: MediaLibraryUploadRow[] }) {
  const router = useRouter()
  const [busyUploadId, setBusyUploadId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const startEditorProject = async (uploadId: string, title: string) => {
    setBusyUploadId(uploadId)
    try {
      const project = await createProject({
        uploadId,
        title: title.replace(/\.[^.]+$/, '') || 'Untitled',
        settings: defaultClipSettings(),
      })
      console.info('[editor:media-library]', 'project_from_upload', { uploadId, projectId: project.id })
      router.push(
        isScriptEditorEnabled() ? `/app/clips/${project.id}/script` : `/app/clips/${project.id}`,
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create project')
    } finally {
      setBusyUploadId(null)
    }
  }

  const onFile = (file: File) => {
    setUploading(true)
    void uploadClipFile(file, async (p) => {
      if (p.state === 'error') {
        setUploading(false)
        toast.error(p.error ?? 'Upload failed')
        return
      }
      if (p.state === 'complete' && p.uploadId) {
        setUploading(false)
        await startEditorProject(p.uploadId, file.name)
      }
    }).catch(() => setUploading(false))
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border p-4">
        <p className="mb-3 text-sm text-muted-foreground">
          Upload once, then open or create a clips project from any file.
        </p>
        <Dropzone onFile={onFile} disabled={uploading} />
        {uploading ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Uploading…
          </p>
        ) : null}
      </div>

      {uploads.length === 0 ? (
        <p className="text-sm text-muted-foreground">No uploaded media yet. Drop a video or audio file above.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {uploads.map((u) => (
            <li key={u.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <FileVideo className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate font-medium text-sm">{u.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(u.bytes)} · {formatDuration(u.durationMs)} ·{' '}
                    {new Date(u.createdAt).toLocaleDateString()}
                  </p>
                  {u.projectIds.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {u.projectIds.map((p) => (
                        <li key={p.id}>
                          <Link
                            href={
                              isScriptEditorEnabled()
                                ? `/app/clips/${p.id}/script`
                                : `/app/clips/${p.id}`
                            }
                            className="text-xs text-primary underline-offset-2 hover:underline"
                          >
                            {p.title}
                          </Link>
                          <span className="ml-2 inline-flex align-middle">
                            <ProjectStatusBadge status={p.status} showSpinner={false} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                {u.projectIds[0] ? (
                  <Button
                    type="button"
                    size="sm"
                    render={
                      <Link
                        href={
                          isScriptEditorEnabled()
                            ? `/app/clips/${u.projectIds[0].id}/script`
                            : `/app/clips/${u.projectIds[0].id}`
                        }
                      />
                    }
                  >
                    Open project
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busyUploadId === u.id}
                    onClick={() => void startEditorProject(u.id, u.filename)}
                  >
                    {busyUploadId === u.id ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Upload className="size-4" aria-hidden />
                    )}
                    Use in editor
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

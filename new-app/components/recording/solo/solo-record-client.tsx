'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Video } from 'lucide-react'
import { PageHeader } from '@/components/app/page-primitives'
import { Button } from '@/components/ui/button'
import { EditorRecorderBar } from '@/components/recording/editor/editor-recorder-bar'
import { useEditorRecorder } from '@/components/recording/editor/use-editor-recorder'
import { listUnfinishedTrackMetas } from '@/lib/recording/chunk-store'
import { RoomsUploadCard } from '@/components/recording/rooms/upload-card'
import { useRecordingEnabled } from '@/lib/recording/use-recording-enabled'

export function SoloRecordClient() {
  const router = useRouter()
  const roomsEnabled = useRecordingEnabled()
  const [projectId, setProjectId] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [prepareError, setPrepareError] = useState<string | null>(null)
  const [prepareAttempt, setPrepareAttempt] = useState(0)
  const [importing, setImporting] = useState(false)
  const [teleprompterOpen, setTeleprompterOpen] = useState(false)
  const [teleprompterText, setTeleprompterText] = useState('')
  const [recoverySessions, setRecoverySessions] = useState<string[]>([])

  const onImportComplete = useCallback(
    (result: { projectId: string; clipsUrl: string }) => {
      setImporting(false)
      router.push(result.clipsUrl)
    },
    [router],
  )

  const recorder = useEditorRecorder(projectId ?? '', { onImportComplete })

  useEffect(() => {
    let cancelled = false
    void listUnfinishedTrackMetas().then((metas) => {
      if (cancelled) return
      const ids = [...new Set(metas.map((m) => m.sessionId))]
      setRecoverySessions(ids)
    })
    return () => {
      cancelled = true
    }
  }, [recorder.uploadRows])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 20_000)
    setPrepareError(null)
    void (async () => {
      try {
        const res = await fetch('/api/recording/solo/prepare', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title: 'Recording' }),
          signal: controller.signal,
        })
        if (cancelled) return
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Could not prepare recording')
        if (!json?.data?.projectId || !json?.data?.sessionId) {
          throw new Error('Recording preparation returned an incomplete response')
        }
        if (cancelled) return
        setProjectId(json.data.projectId as string)
        setSessionId(json.data.sessionId as string)
        recorder.setArmed(true)
      } catch (e) {
        if (cancelled) return
        setPrepareError(timedOut
          ? 'Recording preparation timed out. Check your connection and try again.'
          : e instanceof Error ? e.message : 'Could not prepare recording')
      } finally {
        clearTimeout(timeout)
      }
    })()
    return () => {
      cancelled = true
      clearTimeout(timeout)
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- retry only on explicit user action
  }, [prepareAttempt])

  const handleStop = useCallback(async () => {
    setImporting(true)
    try {
      await recorder.stopRecording()
    } catch (e) {
      setImporting(false)
      setPrepareError(e instanceof Error ? e.message : 'Could not finish recording')
    }
  }, [recorder])

  const recoveryLinks = useMemo(
    () =>
      recoverySessions.filter((id) => id !== sessionId).map((id) => ({
        id,
        href: `/app/record/recover/${id}`,
      })),
    [recoverySessions, sessionId],
  )

  if (prepareError) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
        <PageHeader icon={Video} iconTone="record" title="Record" />
        <p role="alert" className="text-sm text-destructive">{prepareError}</p>
        <Button type="button" onClick={() => setPrepareAttempt((n) => n + 1)}>Retry preparation</Button>
        <Button variant="outline" render={<Link href="/app/clips" />}>Back to projects</Button>
      </div>
    )
  }

  if (!projectId) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
        <PageHeader icon={Video} iconTone="record" title="Record" />
        <p className="text-sm text-muted-foreground">Preparing recording workspace…</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col">
      <div className="border-b border-border px-4 py-3">
        <PageHeader icon={Video} iconTone="record" title="Record" />
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Camera and microphone are saved locally in this browser while recording, then uploaded in
          chunks. If upload is interrupted, use Resume upload below — recordings are not deleted until
          you confirm upload.
        </p>
      </div>

      {recoveryLinks.length > 0 ? (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <AlertTriangle className="size-4 text-amber-600" aria-hidden />
            <span>Unfinished uploads from a previous session.</span>
            {recoveryLinks.map((l) => (
              <Button key={l.id} variant="outline" size="sm" className="h-8" render={<Link href={l.href} />}>
                Resume
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <EditorRecorderBar
        armed={recorder.armed}
        onDisarm={() => router.push('/app/clips')}
        onTeleprompter={() => setTeleprompterOpen((open) => !open)}
        recording={recorder.recording}
        countdown={recorder.countdown}
        recSeconds={recorder.recSeconds}
        cameras={recorder.cameras}
        mics={recorder.mics}
        cameraId={recorder.cameraId}
        micId={recorder.micId}
        onCameraId={recorder.setCameraId}
        onMicId={recorder.setMicId}
        countdownEnabled={recorder.countdownEnabled}
        onCountdownEnabled={recorder.setCountdownEnabled}
        onStart={() => void recorder.startRecording()}
        onStop={() => void handleStop()}
        onPause={() => undefined}
        recordLabel="Start recording"
      />

      {teleprompterOpen ? (
        <section className="mx-auto mt-3 w-full max-w-[960px] rounded-xl border border-border bg-card p-3" aria-label="Teleprompter" data-testid="solo-teleprompter">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Teleprompter notes</h2>
            <Button type="button" variant="ghost" size="sm" onClick={() => setTeleprompterOpen(false)}>Close teleprompter</Button>
          </div>
          <p className="mb-2 text-xs text-muted-foreground">Prepare your script without camera or microphone permission. Notes stay on this page and are not included in the recording.</p>
          <textarea aria-label="Teleprompter script" className="min-h-28 w-full rounded-md border border-border bg-background p-3 text-sm" value={teleprompterText} onChange={(event) => setTeleprompterText(event.target.value)} placeholder="Enter what you want to say…" />
        </section>
      ) : null}
      <div className="mx-auto flex w-full max-w-[960px] flex-1 flex-col items-center gap-4 p-6">
        <div className="flex aspect-video w-full max-w-[960px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 text-sm text-muted-foreground">
          Camera / screen preview
        </div>
        {importing ? (
          <p className="text-sm text-muted-foreground">Uploading and starting clip processing…</p>
        ) : (
          <p className="max-w-md text-center text-sm text-muted-foreground">
            When you stop, your recording is uploaded and opens in the clip project view (same pipeline
            as file upload).
          </p>
        )}
        {recorder.uploadRows.length > 0 ? (
          <div className="w-full max-w-md">
            <RoomsUploadCard rows={recorder.uploadRows} onCopyRecoveryLink={() => {
              if (sessionId) navigator.clipboard.writeText(`${window.location.origin}/app/record/recover/${sessionId}`)
            }} />
          </div>
        ) : null}
        {sessionId ? (
          <Button variant="link" className="text-xs" render={<Link href={`/app/record/recover/${sessionId}`} />}>
            Open upload recovery for this session
          </Button>
        ) : null}
        {roomsEnabled ? (
          <Button variant="outline" render={<Link href="/app/rooms/new" />}>
            Record with others (Rooms)
          </Button>
        ) : null}
      </div>
    </div>
  )
}

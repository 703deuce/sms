'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

type ExportTab = 'video' | 'audio' | 'transcript' | 'subtitles'

export function ScriptExportPopover({
  open,
  onClose,
  compositionId,
  title,
  durationMs,
  aspect,
}: {
  open: boolean
  onClose: () => void
  compositionId: string
  title: string
  durationMs: number
  aspect: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<ExportTab>('video')
  const [advancedOpen, setAdvancedOpen] = useState(true)
  const [resolution, setResolution] = useState<'720p' | '1080p' | '4k'>('1080p')
  const [quality, setQuality] = useState('recommended')
  const [burnCaptions, setBurnCaptions] = useState(true)
  const [includeSubs, setIncludeSubs] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [renderId, setRenderId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setProgress(null)
      setRenderId(null)
      setBusy(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const pollRender = useCallback(
    (rid: string) => {
      const t = setInterval(() => {
        void fetch(`/api/clips/compositions/${compositionId}/export/${rid}`)
          .then((r) => r.json())
          .then((data) => {
            if (typeof data.progress === 'number') setProgress(data.progress)
            if (data.status === 'READY' && data.downloadUrl) {
              clearInterval(t)
              setProgress(100)
              setBusy(false)
              toast.success(
                data.edlDurationMs && data.outputDurationMs
                  ? `Export ready (${Math.round(data.outputDurationMs / 1000)}s)`
                  : 'Export ready',
              )
              window.open(data.downloadUrl, '_blank')
            } else if (data.status === 'FAILED') {
              clearInterval(t)
              setBusy(false)
              toast.error(data.error ?? 'Export failed')
            } else {
              setProgress((p) => (p == null ? 12 : Math.min(95, p + 8)))
            }
          })
          .catch(() => {})
      }, 2000)
      return () => clearInterval(t)
    },
    [compositionId],
  )

  const onExportVideo = async () => {
    setBusy(true)
    setProgress(4)
    try {
      const res = await fetch(`/api/clips/compositions/${compositionId}/export/video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exportKind: 'video',
          resolution,
          quality,
          burnCaptions,
          includeSubtitleTrack: includeSubs,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Export failed')
      setRenderId(data.renderId)
      pollRender(data.renderId)
    } catch (e) {
      setBusy(false)
      toast.error(e instanceof Error ? e.message : 'Export failed')
    }
  }

  const onExportTranscript = () => {
    const lines = [`# ${title}`, '', '_Transcript export — open in editor for full formatting._']
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/\s+/g, '_')}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Transcript downloaded')
  }

  if (!open) return null

  const durLabel = `${Math.floor(durationMs / 60000)}:${String(Math.floor((durationMs % 60000) / 1000)).padStart(2, '0')}`
  const tabs: { id: ExportTab; label: string }[] = [
    { id: 'video', label: 'Video' },
    { id: 'audio', label: 'Audio' },
    { id: 'transcript', label: 'Transcript' },
    { id: 'subtitles', label: 'Subtitles' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-3 pt-14" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/20" aria-label="Close export" onClick={onClose} />
      <div
        ref={panelRef}
        className="relative z-10 flex max-h-[calc(100vh-72px)] w-[420px] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl"
        role="dialog"
        aria-label="Export"
      >
        <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-border px-4">
          <h2 className="text-base font-semibold">Export</h2>
          <Button type="button" size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </header>

        <div className="mx-4 mt-3 flex h-8 gap-1 rounded-lg bg-muted p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={cn(
                'flex-1 rounded-md text-xs font-medium transition-colors',
                tab === t.id ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {tab === 'video' && (
            <>
              <div className="relative mb-4 aspect-video w-full overflow-hidden rounded-lg bg-muted">
                <div className="absolute bottom-2 right-2 flex gap-1">
                  <span className="rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">⏱ {durLabel}</span>
                  <span className="rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">🗎 ~{aspect}</span>
                </div>
              </div>
              <ExportRow label="Destination">
                <Select defaultValue="local">
                  <SelectTrigger className="h-8 w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local export</SelectItem>
                    <SelectItem value="web">Web link</SelectItem>
                  </SelectContent>
                </Select>
              </ExportRow>
              <ExportRow label="Resolution">
                <Select value={resolution} onValueChange={(v) => setResolution(v as typeof resolution)}>
                  <SelectTrigger className="h-8 w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="720p">720p</SelectItem>
                    <SelectItem value="1080p">Max (1080p)</SelectItem>
                    <SelectItem value="4k">4K</SelectItem>
                  </SelectContent>
                </Select>
              </ExportRow>
              <ExportRow label="Quality">
                <Select value={quality} onValueChange={(v) => v && setQuality(v)}>
                  <SelectTrigger className="h-8 w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recommended">Recommended</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </ExportRow>
              <button
                type="button"
                className="flex h-10 w-full items-center justify-between text-[13px] font-semibold"
                onClick={() => setAdvancedOpen((o) => !o)}
              >
                Advanced
                {advancedOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>
              {advancedOpen && (
                <div className="space-y-3 pb-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Burn-in captions</Label>
                    <Switch checked={burnCaptions} onCheckedChange={setBurnCaptions} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Include subtitle track</Label>
                    <Switch checked={includeSubs} onCheckedChange={setIncludeSubs} />
                  </div>
                </div>
              )}
            </>
          )}
          {tab === 'transcript' && (
            <p className="text-sm text-muted-foreground">
              Export the current composition transcript as Markdown. Word-level timing and speaker labels follow your
              caption settings.
            </p>
          )}
          {tab === 'subtitles' && (
            <ExportRow label="Format">
              <Select defaultValue="srt">
                <SelectTrigger className="h-8 w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="srt">SRT</SelectItem>
                  <SelectItem value="vtt">VTT</SelectItem>
                </SelectContent>
              </Select>
            </ExportRow>
          )}
          {tab === 'audio' && (
            <ExportRow label="Format">
              <Select defaultValue="wav">
                <SelectTrigger className="h-8 w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wav">WAV</SelectItem>
                  <SelectItem value="mp3">MP3</SelectItem>
                </SelectContent>
              </Select>
            </ExportRow>
          )}
        </div>

        <footer className="shrink-0 border-t border-border p-4">
          {busy && progress != null ? (
            <div className="flex h-10 flex-col justify-center rounded-lg bg-primary/10 px-3">
              <div className="text-xs font-medium">Exporting {progress}%</div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <Button
              type="button"
              className="h-10 w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-90"
              onClick={() => {
                if (tab === 'video') void onExportVideo()
                else if (tab === 'transcript') onExportTranscript()
                else toast.message('Use Video export for this format in M5')
              }}
            >
              Export
            </Button>
          )}
        </footer>
      </div>
    </div>
  )
}

function ExportRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 flex h-10 items-center justify-between gap-2 px-0">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

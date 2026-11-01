'use client'

import { useEffect, useRef } from 'react'
import { Mic, Monitor, ScrollText, Settings, Square, Trash2, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AudioMeter, usePeakLevels } from '@/components/clips/editor/audio-meter'
import { cn } from '@/lib/utils'
import type { VideoPlaceMode } from '@/lib/clips/editor/recording'
import type { ClipRecorderMode } from '@/components/clips/editor/recording/use-clip-recorder'

const PLACE_LABEL: Record<VideoPlaceMode, string> = {
  insert: 'Insert at playhead',
  append: 'Append at end',
  overlay: 'Overlay (B-roll) at playhead',
}

export function ClipRecorderBar({
  mode,
  recording,
  countdown,
  recSeconds,
  cameras,
  mics,
  cameraId,
  micId,
  onCameraId,
  onMicId,
  countdownEnabled,
  onCountdownEnabled,
  mutePreview,
  onMutePreview,
  placeMode,
  onPlaceMode,
  analysers,
  previewStream,
  onDisarm,
  onStart,
  onStop,
  onCancel,
}: {
  mode: ClipRecorderMode
  recording: boolean
  countdown: number | null
  recSeconds: number
  cameras: { deviceId: string; label: string }[]
  mics: { deviceId: string; label: string }[]
  cameraId: string
  micId: string
  onCameraId: (id: string) => void
  onMicId: (id: string) => void
  countdownEnabled: boolean
  onCountdownEnabled: (on: boolean) => void
  mutePreview: boolean
  onMutePreview: (on: boolean) => void
  placeMode: VideoPlaceMode
  onPlaceMode: (m: VideoPlaceMode) => void
  analysers: [AnalyserNode | null, AnalyserNode | null] | null
  previewStream: MediaStream | null
  onDisarm: () => void
  onStart: () => void
  onStop: () => void
  onCancel: () => void
}) {
  const levels = usePeakLevels(analysers)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.srcObject = previewStream
    void v.play().catch(() => {})
  }, [previewStream])

  useEffect(() => {
    if (!recording) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      } else if (e.key === ' ' && recording) {
        e.preventDefault()
        onStop()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, onStop, recording])

  if (recording) {
    return (
      <div className="flex h-[52px] shrink-0 items-center gap-2 border-t border-border bg-card px-3" data-testid="recorder-bar">
        <Button variant="ghost" size="icon" className="size-8" title="Discard" onClick={onCancel}>
          <Trash2 className="size-4" />
        </Button>
        <AudioMeter levels={levels} />
        {mode === 'camera' && previewStream ? (
          <video ref={videoRef} muted playsInline className="h-10 w-16 scale-x-[-1] rounded bg-black object-cover" />
        ) : null}
        <Button
          className="h-8 gap-2 bg-lane-record px-3 text-white hover:bg-lane-record/90"
          onClick={onStop}
          data-testid="recorder-stop"
        >
          <Square className="size-3 fill-current" />
          <span className="font-mono text-xs tabular-nums">
            {Math.floor(recSeconds / 60)}:{(recSeconds % 60).toString().padStart(2, '0')}
          </span>
        </Button>
        <span className="ml-auto rounded-full bg-lane-record px-2 py-0.5 font-mono text-[11px] text-white">● REC</span>
      </div>
    )
  }

  return (
    <div className="relative flex h-[52px] shrink-0 flex-wrap items-center gap-2 border-t border-border bg-card px-3" data-testid="recorder-bar">
      <Button variant="ghost" size="icon" className="size-7" onClick={onDisarm}>
        ×
      </Button>
      {mode === 'camera' ? (
        <>
          <DeviceSelect
            icon={Video}
            label={cameras.find((c) => c.deviceId === cameraId)?.label ?? 'Camera'}
            options={cameras}
            value={cameraId}
            onChange={onCameraId}
          />
          <DeviceSelect
            icon={Mic}
            label={mics.find((m) => m.deviceId === micId)?.label ?? 'Microphone'}
            options={mics}
            value={micId}
            onChange={onMicId}
          />
          <DeviceSelect icon={Monitor} label="No screen shared" options={[]} value="" onChange={() => undefined} />
        </>
      ) : (
        <DeviceSelect
          icon={Mic}
          label={mics.find((m) => m.deviceId === micId)?.label ?? 'Microphone'}
          options={mics}
          value={micId}
          onChange={onMicId}
        />
      )}
      <AudioMeter levels={levels} />
      {mode === 'voiceover' ? (
        <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <input
            type="checkbox"
            checked={mutePreview}
            onChange={(e) => onMutePreview(e.target.checked)}
            data-testid="recorder-mute-preview"
          />
          Mute preview
        </label>
      ) : (
        <Select value={placeMode} onValueChange={(v) => onPlaceMode(v as VideoPlaceMode)}>
          <SelectTrigger className="h-8 w-[200px] text-xs" data-testid="recorder-place">
            <SelectValue>{PLACE_LABEL[placeMode]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PLACE_LABEL) as VideoPlaceMode[]).map((k) => (
              <SelectItem key={k} value={k}>
                {PLACE_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Button className={cn('h-8 gap-1 bg-lane-record text-white hover:bg-lane-record/90')} onClick={onStart}>
        <span className="size-2 rounded-full bg-white" />
        {mode === 'voiceover' ? 'Record voiceover' : 'Record camera'}
      </Button>
      <Popover>
        <PopoverTrigger render={<Button variant="ghost" size="icon" className="size-7"><Settings className="size-4" /></Button>} />
        <PopoverContent className="w-72 p-3" align="end">
          <p className="text-xs font-semibold uppercase text-muted-foreground">General</p>
          <label className="mt-2 flex h-9 items-center justify-between text-[13px]">
            Countdown
            <input type="checkbox" checked={countdownEnabled} onChange={(e) => onCountdownEnabled(e.target.checked)} />
          </label>
          {mode === 'voiceover' ? (
            <p className="mt-2 text-[11px] text-muted-foreground">Use headphones to avoid echo.</p>
          ) : null}
        </PopoverContent>
      </Popover>
      <Button variant="ghost" size="icon" className="size-7" disabled title="Teleprompter (batch 2)">
        <ScrollText className="size-4 opacity-40" />
      </Button>
      {countdown != null ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
          <div className="flex size-40 items-center justify-center rounded-full bg-black/60 text-7xl font-bold text-white">
            {countdown}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function DeviceSelect({
  icon: Icon,
  label,
  options,
  value,
  onChange,
}: {
  icon: typeof Video
  label: string
  options: { deviceId: string; label: string }[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="h-8 max-w-[140px] gap-1 truncate text-xs">
            <Icon className="size-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </Button>
        }
      />
      <PopoverContent className="w-64 p-1" align="start">
        {!options.length ? <p className="px-2 py-1 text-xs text-muted-foreground">No device</p> : null}
        {options.map((o) => (
          <button
            key={o.deviceId}
            type="button"
            className={cn('block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-muted', value === o.deviceId && 'bg-muted')}
            onClick={() => onChange(o.deviceId)}
          >
            {o.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

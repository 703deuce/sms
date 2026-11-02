'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, Monitor, ScrollText, Settings, Square, Trash2, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AudioMeter, usePeakLevels } from '@/components/clips/editor/audio-meter'
import { TeleprompterPanel } from '@/components/recording/editor/teleprompter-panel'
import type { BubbleCorner, BubbleSize } from '@/lib/clips/editor/recording-bubble'
import { cn } from '@/lib/utils'
import type { VideoPlaceMode } from '@/lib/clips/editor/recording'
import type { ClipRecorderMode } from '@/components/clips/editor/recording/use-clip-recorder'

const PLACE_LABEL: Record<VideoPlaceMode, string> = {
  insert: 'Insert at playhead',
  append: 'Append at end',
  overlay: 'Overlay (B-roll) at playhead',
}

const CORNER_LABEL: Record<BubbleCorner, string> = { se: '↘', sw: '↙', ne: '↗', nw: '↖' }

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
  bubbleOn,
  onBubbleOn,
  bubbleCorner,
  onBubbleCorner,
  bubbleSize,
  onBubbleSize,
  analysers,
  previewStream,
  teleprompterOpen,
  onTeleprompterOpen,
  scriptText,
  onScriptText,
  onUseTranscript,
  teleprompterPlaying,
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
  bubbleOn: boolean
  onBubbleOn: (on: boolean) => void
  bubbleCorner: BubbleCorner
  onBubbleCorner: (c: BubbleCorner) => void
  bubbleSize: BubbleSize
  onBubbleSize: (s: BubbleSize) => void
  analysers: [AnalyserNode | null, AnalyserNode | null] | null
  previewStream: MediaStream | null
  teleprompterOpen: boolean
  onTeleprompterOpen: (open: boolean) => void
  scriptText: string
  onScriptText: (t: string) => void
  onUseTranscript?: () => void
  teleprompterPlaying: boolean
  onDisarm: () => void
  onStart: () => void
  onStop: () => void
  onCancel: () => void
}) {
  const levels = usePeakLevels(analysers)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [tpDraft, setTpDraft] = useState(scriptText)

  useEffect(() => setTpDraft(scriptText), [scriptText])

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

  const recordLabel =
    mode === 'voiceover' ? 'Record voiceover' : mode === 'screen' ? 'Record screen' : 'Record camera'

  const showTeleprompter = mode !== 'voiceover'

  if (recording) {
    return (
      <>
        <TeleprompterPanel
          open={teleprompterOpen && showTeleprompter}
          onClose={() => onTeleprompterOpen(false)}
          scriptText={scriptText}
          playing={teleprompterPlaying}
          onTogglePlay={() => undefined}
        />
        <div className="flex h-[52px] shrink-0 items-center gap-2 border-t border-border bg-card px-3" data-testid="recorder-bar">
          <Button variant="ghost" size="icon" className="size-8" title="Discard" onClick={onCancel}>
            <Trash2 className="size-4" />
          </Button>
          <AudioMeter levels={levels} />
          {(mode === 'camera' || mode === 'screen') && previewStream ? (
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
      </>
    )
  }

  return (
    <>
      <TeleprompterPanel
        open={teleprompterOpen && showTeleprompter}
        onClose={() => onTeleprompterOpen(false)}
        scriptText={scriptText}
        playing={false}
        onTogglePlay={() => undefined}
      />
      <div className="relative flex min-h-[52px] shrink-0 flex-wrap items-center gap-2 border-t border-border bg-card px-3 py-2" data-testid="recorder-bar">
        <Button variant="ghost" size="icon" className="size-7" onClick={onDisarm}>
          ×
        </Button>
        {mode === 'screen' ? (
          <>
            <DeviceSelect
              icon={Mic}
              label={mics.find((m) => m.deviceId === micId)?.label ?? 'Microphone'}
              options={mics}
              value={micId}
              onChange={onMicId}
            />
            {bubbleOn ? (
              <DeviceSelect
                icon={Video}
                label={cameras.find((c) => c.deviceId === cameraId)?.label ?? 'Camera (bubble)'}
                options={cameras}
                value={cameraId}
                onChange={onCameraId}
              />
            ) : null}
            <label className="flex items-center gap-1 text-[11px]" data-testid="recorder-bubble">
              <input type="checkbox" checked={bubbleOn} onChange={(e) => onBubbleOn(e.target.checked)} />
              Bubble
            </label>
            {bubbleOn ? (
              <>
                <Select value={bubbleCorner} onValueChange={(v) => onBubbleCorner(v as BubbleCorner)}>
                  <SelectTrigger className="h-8 w-16 text-xs">{CORNER_LABEL[bubbleCorner]}</SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CORNER_LABEL) as BubbleCorner[]).map((c) => (
                      <SelectItem key={c} value={c}>
                        {CORNER_LABEL[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={bubbleSize} onValueChange={(v) => onBubbleSize(v as BubbleSize)}>
                  <SelectTrigger className="h-8 w-14 text-xs">{bubbleSize}</SelectTrigger>
                  <SelectContent>
                    {(['S', 'M', 'L'] as BubbleSize[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : null}
            <span className="text-[11px] text-muted-foreground">System audio when the browser offers it</span>
          </>
        ) : mode === 'camera' ? (
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
          {recordLabel}
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
        {showTeleprompter ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              data-testid="recorder-teleprompter"
              onClick={() => onTeleprompterOpen(!teleprompterOpen)}
            >
              <ScrollText className="size-4" />
            </Button>
            <Popover>
              <PopoverTrigger render={<Button variant="link" className="h-7 px-1 text-[11px]">Script</Button>} />
              <PopoverContent className="w-80 p-3" align="end">
                <p className="text-xs font-semibold">Paste your script</p>
                <textarea
                  className="mt-2 h-24 w-full rounded border bg-background p-2 text-xs"
                  value={tpDraft}
                  onChange={(e) => {
                    setTpDraft(e.target.value)
                    onScriptText(e.target.value)
                  }}
                  data-testid="recorder-teleprompter-text"
                />
                {onUseTranscript ? (
                  <Button size="sm" variant="outline" className="mt-2" onClick={onUseTranscript}>
                    Use transcript
                  </Button>
                ) : null}
              </PopoverContent>
            </Popover>
          </>
        ) : null}
        {countdown != null ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
            <div className="flex size-40 items-center justify-center rounded-full bg-black/60 text-7xl font-bold text-white">
              {countdown}
            </div>
          </div>
        ) : null}
      </div>
    </>
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

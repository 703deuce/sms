'use client'

import { ChevronDown, ScrollText, Settings, Video, Mic, Monitor, Trash2, RotateCcw, Pause, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/** §21.1 editor recorder bar (h52) — replaces transport while armed */
export function EditorRecorderBar({
  armed,
  onDisarm,
  onTeleprompter,
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
  onStart,
  onStop,
  onPause,
}: {
  armed: boolean
  onDisarm: () => void
  onTeleprompter: () => void
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
  onStart: () => void
  onStop: () => void
  onPause: () => void
}) {
  if (!armed) return null

  if (recording) {
    return (
      <div className="flex h-[52px] shrink-0 items-center gap-2 border-b border-border bg-card px-3">
        <Button variant="ghost" size="icon" className="size-8" title="Discard"><Trash2 className="size-4" /></Button>
        <Button variant="ghost" size="icon" className="size-8" title="Restart"><RotateCcw className="size-4" /></Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={onPause} title="Pause"><Pause className="size-4" /></Button>
        <Button className="h-8 gap-2 bg-lane-record px-3 text-white hover:bg-lane-record/90" onClick={onStop}>
          <Square className="size-3 fill-current" />
          <span className="font-mono text-xs tabular-nums">
            {Math.floor(recSeconds / 60)}:{(recSeconds % 60).toString().padStart(2, '0')}
          </span>
        </Button>
        <span className="ml-auto rounded-full bg-lane-record px-2 py-0.5 font-mono text-[11px] text-white">
          ● REC {Math.floor(recSeconds / 60)}:{(recSeconds % 60).toString().padStart(2, '0')}
        </span>
      </div>
    )
  }

  return (
    <div className="relative flex h-[52px] shrink-0 items-center gap-2 border-b border-border bg-card px-3">
      <Button variant="ghost" size="icon" className="size-7" onClick={onDisarm}>×</Button>
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
      <Button
        className={cn('h-8 gap-1 bg-lane-record text-white hover:bg-lane-record/90')}
        onClick={onStart}
      >
        <span className="size-2 rounded-full bg-white" /> Record into script
        <ChevronDown className="size-4 opacity-80" />
      </Button>
      <Popover>
        <PopoverTrigger render={<Button variant="ghost" size="icon" className="size-7"><Settings className="size-4" /></Button>} />
        <PopoverContent className="w-72 p-3" align="end">
          <p className="text-xs font-semibold uppercase text-muted-foreground">General</p>
          <label className="mt-2 flex h-9 items-center justify-between text-[13px]">
            Countdown
            <input type="checkbox" checked={countdownEnabled} onChange={(e) => onCountdownEnabled(e.target.checked)} />
          </label>
        </PopoverContent>
      </Popover>
      <Button variant="ghost" size="icon" className="size-7" onClick={onTeleprompter}><ScrollText className="size-4" /></Button>
      {countdown != null && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
          <div className="flex size-40 items-center justify-center rounded-full bg-black/60 text-7xl font-bold text-white">
            {countdown}
          </div>
        </div>
      )}
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
    <select
      className="flex h-8 max-w-[150px] items-center gap-1.5 rounded-lg border border-border bg-background px-2 text-[13px]"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.deviceId} value={o.deviceId}>{o.label}</option>
      ))}
    </select>
  )
}

export function EditorRecordMenuItem({ onStartRoom }: { onStartRoom: () => void }) {
  return (
    <button type="button" className="flex h-8 items-center gap-2 px-2 text-[13px] hover:bg-accent/60" onClick={onStartRoom}>
      <span className="size-2 rounded-full bg-lane-record" /> Invite others to record
    </button>
  )
}

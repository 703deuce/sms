'use client'

import { useEffect, useRef, useState } from 'react'
import { FolderOpen, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { fetchUploadLimits } from '@/lib/clips/upload'

const ACCEPT = 'video/mp4,video/quicktime,video/webm,video/x-m4v,audio/mpeg,audio/wav,.mp4,.mov,.webm,.m4v,.mp3,.wav'
export const CLIP_UPLOAD_MAX_LABEL_FALLBACK = '50 MB'

export function Dropzone({ onFile, disabled }: { onFile: (file: File) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [maxLabel, setMaxLabel] = useState(CLIP_UPLOAD_MAX_LABEL_FALLBACK)

  useEffect(() => {
    void fetchUploadLimits()
      .then((l) => setMaxLabel(l.maxLabel))
      .catch(() => setMaxLabel(CLIP_UPLOAD_MAX_LABEL_FALLBACK))
  }, [])

  const pick = () => {
    if (disabled) return
    inputRef.current?.click()
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      data-drag={drag || undefined}
      onClick={pick}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          pick()
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        const file = e.dataTransfer.files?.[0]
        if (file) onFile(file)
      }}
      className={cn(
        'relative grid min-h-[280px] cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-border bg-card/50 p-8 text-center transition',
        'data-[drag=true]:border-primary data-[drag=true]:bg-primary/5 data-[drag=true]:shadow-glow',
        disabled && 'pointer-events-none opacity-60',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        disabled={disabled}
        aria-label={`Upload video or audio file, up to ${maxLabel}`}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
      <div className="flex flex-col items-center gap-4">
        <span
          className={cn(
            'grid size-14 place-items-center rounded-2xl tile-primary',
            drag && 'animate-bounce',
          )}
        >
          <UploadCloud className="size-7" aria-hidden />
        </span>
        <div>
          <p className="text-base font-semibold">Drop a video or audio file</p>
          <p className="mt-1 text-sm text-muted-foreground">
            or click to browse · MP4, MOV, WebM, MP3, WAV · up to {maxLabel}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation()
            pick()
          }}
        >
          <FolderOpen className="size-4" aria-hidden />
          Choose file
        </Button>
      </div>
    </div>
  )
}

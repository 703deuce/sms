'use client'

import { useRef, useState } from 'react'
import { FolderOpen, UploadCloud } from 'lucide-react'
import { cn } from '@/lib/utils'

const ACCEPT = 'video/mp4,video/quicktime,video/webm,video/x-m4v,audio/mpeg,audio/wav,.mp4,.mov,.webm,.m4v,.mp3,.wav'
export const CLIP_UPLOAD_MAX_LABEL = '5 GB'

export function Dropzone({ onFile, disabled }: { onFile: (file: File) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  return (
    <label
      data-drag={drag || undefined}
      onClick={(e) => {
        if (disabled) return
        e.preventDefault()
        inputRef.current?.click()
      }}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          inputRef.current?.click()
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
        className="sr-only"
        disabled={disabled}
        aria-label={`Upload video or audio file, up to ${CLIP_UPLOAD_MAX_LABEL}`}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
        }}
      />
      <div className="pointer-events-none flex flex-col items-center gap-4">
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
            or click to browse · MP4, MOV, WebM, MP3, WAV · up to {CLIP_UPLOAD_MAX_LABEL}
          </p>
        </div>
        <span
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium"
          aria-hidden
        >
          <FolderOpen className="size-4" aria-hidden />
          Choose file
        </span>
      </div>
    </label>
  )
}

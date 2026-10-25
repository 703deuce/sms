'use client'

import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

const ACCEPT = 'video/mp4,video/quicktime,video/webm,video/x-m4v,.mp4,.mov,.webm,.m4v'

export function Dropzone({ onFile, disabled }: { onFile: (file: File) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
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
      onClick={() => inputRef.current?.click()}
      className={cn(
        'flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border surface-raised px-6 py-10 text-center transition-colors',
        drag && 'border-primary bg-accent/40',
        disabled && 'pointer-events-none opacity-60',
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-xl tile-primary">
        <Upload className="size-5" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-medium">Drop a video or click to browse</p>
        <p className="text-xs text-muted-foreground">MP4, MOV, WebM · up to 5 GB</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
        }}
      />
    </div>
  )
}

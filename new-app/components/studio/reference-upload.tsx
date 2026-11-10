'use client'

import { useRef } from 'react'
import { ImagePlus, X } from 'lucide-react'
import type { StudioAssetSlot } from '../../lib/ai-studio/contract'
import type { LocalAsset } from '../../lib/ai-studio/controller'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

const LABELS: Record<StudioAssetSlot, { title: string; hint: string }> = {
  reference: { title: 'Reference', hint: 'Drop an image, or click to upload' },
  start_frame: { title: 'Start frame', hint: 'First frame of the clip' },
  end_frame: { title: 'End frame', hint: 'Last frame of the clip' },
}

export function ReferenceUpload({
  slot,
  asset,
  onChange,
  disabled,
}: {
  slot: StudioAssetSlot
  asset?: LocalAsset
  onChange: (file: File | null) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const label = LABELS[slot]

  function take(files: FileList | null) {
    const file = files?.[0]
    if (file) onChange(file)
  }

  return (
    <div className="flex flex-col gap-1.5" data-testid={`studio-upload-${slot}`}>
      <p className="text-xs font-medium text-foreground">{label.title}</p>
      {asset ? (
        <div className="relative overflow-hidden rounded-lg border border-border bg-secondary">
          {asset.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset.previewUrl} alt={asset.name} className="aspect-video w-full object-cover" />
          ) : (
            <div className="aspect-video grid place-items-center text-xs text-muted-foreground">{asset.name}</div>
          )}
          <Button
            type="button"
            size="icon-xs"
            variant="secondary"
            className="absolute top-1.5 right-1.5"
            aria-label={`Remove ${label.title}`}
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            <X className="size-3" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
          }}
          onDrop={(e) => {
            e.preventDefault()
            if (!disabled) take(e.dataTransfer.files)
          }}
          className={cn(
            'flex aspect-video w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/40 px-3 text-center transition-colors',
            'hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <ImagePlus className="size-4 text-muted-foreground" aria-hidden />
          <span className="text-xs text-muted-foreground">{label.hint}</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          take(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}

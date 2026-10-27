'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PrimaryButton } from '@/components/app/primary-button'

export function T2vFocalCropModal({
  open,
  imageUrl,
  focalX,
  focalY,
  onClose,
  onSave,
}: {
  open: boolean
  imageUrl: string
  focalX: number
  focalY: number
  onClose: () => void
  onSave: (focalX: number, focalY: number) => void
}) {
  const [fx, setFx] = useState(focalX)
  const [fy, setFy] = useState(focalY)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="dialog">
      <div className="w-full max-w-xl rounded-xl border border-border bg-card p-4 shadow-lg">
        <h2 className="text-lg font-semibold">Crop &amp; focus</h2>
        <p className="text-xs text-muted-foreground">Click to set the focal point for cover-fit and Ken Burns.</p>
        <button
          type="button"
          className="relative mt-3 aspect-video w-full overflow-hidden rounded-lg border border-border"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            setFx(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)))
            setFy(Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)))
          }}
        >
          <img src={imageUrl} alt="" className="size-full object-cover" />
          <span
            className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow"
            style={{ left: `${fx * 100}%`, top: `${fy * 100}%` }}
          />
        </button>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <PrimaryButton type="button" onClick={() => onSave(fx, fy)}>Done</PrimaryButton>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** §22 teleprompter floating panel */
export function TeleprompterPanel({
  open,
  onClose,
  scriptText,
  playing,
  onTogglePlay,
}: {
  open: boolean
  onClose: () => void
  scriptText: string
  playing: boolean
  onTogglePlay: () => void
}) {
  const [text, setText] = useState(scriptText)
  const [speed, setSpeed] = useState(4)
  const [mirrored, setMirrored] = useState(false)
  const [highContrast, setHighContrast] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => setText(scriptText), [scriptText])

  useEffect(() => {
    if (!playing || !scrollRef.current) return
    const el = scrollRef.current
    const id = window.setInterval(() => {
      el.scrollTop += speed * 0.5
    }, 50)
    return () => window.clearInterval(id)
  }, [playing, speed])

  if (!open) return null

  return (
    <div
      className={cn(
        'pointer-events-auto fixed left-1/2 top-24 z-40 w-[680px] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-xl shadow-lg',
        highContrast ? 'bg-white text-black' : 'bg-[oklch(0.12_0_0)] text-white',
      )}
      style={mirrored ? { transform: 'translateX(-50%) scaleX(-1)' } : { transform: 'translateX(-50%)' }}
    >
      <div className="flex items-center justify-end gap-1 border-b border-white/10 p-2">
        <Button variant="ghost" size="icon" className="size-7 text-white" onClick={onClose}>×</Button>
      </div>
      <div ref={scrollRef} className="max-h-[280px] overflow-y-auto p-8 text-[32px] leading-[1.5]">
        {text ? (
          <p contentEditable suppressContentEditableWarning onInput={(e) => setText(e.currentTarget.textContent ?? '')}>{text}</p>
        ) : (
          <p className="text-white/50">Paste, type, or import from script</p>
        )}
        <div className="pointer-events-none mt-8 h-0.5 w-full bg-primary/60" style={{ marginTop: '33%' }} />
      </div>
      <div className="flex h-12 items-center gap-3 border-t border-white/10 px-4 text-white/80">
        <span className="text-xs">Speed</span>
        <input type="range" min={1} max={10} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-24" />
        <Button variant="ghost" size="sm" className="text-white" onClick={onTogglePlay}>{playing ? 'Pause' : 'Play'}</Button>
        <Button variant="ghost" size="sm" onClick={() => setText(scriptText)}>Import script</Button>
        <Button variant="ghost" size="sm" onClick={() => setMirrored((v) => !v)}>Mirror</Button>
        <Button variant="ghost" size="sm" onClick={() => setHighContrast((v) => !v)}>Contrast</Button>
      </div>
    </div>
  )
}

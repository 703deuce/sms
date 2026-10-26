'use client'

import './caption-anim.css'

import { useMemo } from 'react'
import type { ClipEditsV2, ClipWord } from '@/lib/clips/edits'
import { resolvePreset, type CaptionPreset } from '@/lib/clips/caption-presets'

function positionClass(position: string) {
  if (position === 'top') return 'top-[8%]'
  if (position === 'middle') return 'top-1/2 -translate-y-1/2'
  return 'bottom-[12%]'
}

function displayCase(text: string, caseMode: string) {
  if (caseMode === 'upper') return text.toUpperCase()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function animClass(animation: string) {
  if (animation === 'pop') return 'cap-anim-pop'
  if (animation === 'bounce') return 'cap-anim-bounce'
  if (animation === 'slideup') return 'cap-anim-slideup'
  if (animation === 'glow') return 'cap-anim-glow'
  return ''
}

export function CaptionOverlay({
  words,
  currentTimeSec,
  edits,
  boxHeightPx,
}: {
  words: ClipWord[]
  currentTimeSec: number
  edits: ClipEditsV2
  boxHeightPx: number
}) {
  const cap = edits.captions ?? {}
  const preset = resolvePreset(cap.presetId)
  const animation = (cap.animation || preset.animation) as string
  const wpl = cap.wordsPerLine ?? preset.wordsPerLine
  const caseMode = (cap.case || preset.case) as string
  const sizePct = cap.size ?? preset.sizePct
  const fontSize = Math.max(12, (boxHeightPx * sizePct) / 100)
  const colors = cap.colors
  const emphasis = new Set(cap.emphasis ?? [])

  const activeIdx = words.findIndex((w) => w.s <= currentTimeSec && currentTimeSec < w.e)
  const lineStart = activeIdx >= 0 ? Math.floor(activeIdx / wpl) * wpl : 0
  const lineWords = useMemo(
    () => words.slice(lineStart, lineStart + wpl),
    [lineStart, wpl, words],
  )

  if (activeIdx < 0 || !lineWords.length) return null

  const position = (cap.position || preset.position) as string

  return (
    <div
      className={`pointer-events-none absolute inset-x-2 z-[25] flex flex-wrap justify-center gap-1 text-center ${positionClass(position)}`}
      style={{ fontFamily: preset.font, fontWeight: preset.weight }}
    >
      {lineWords.map((w, i) => {
        const globalIdx = lineStart + i
        const active = globalIdx === activeIdx
        const spk = (w as ClipWord & { spk?: number }).spk ?? 0
        const activeColor =
          spk === 0
            ? colors?.a || preset.active
            : colors?.b || preset.activeB
        const isEmph = emphasis.has(w.idx ?? globalIdx)
        const text = displayCase(w.w, caseMode)
        const strokeW = preset.outlineW
        const inactiveColor = preset.slug === 'boxed' ? '#FFFFFF' : preset.primary
        const style: React.CSSProperties = {
          fontSize,
          color: active || isEmph ? (preset.slug === 'boxed' && active ? '#000000' : activeColor) : inactiveColor,
          WebkitTextStroke: strokeW ? `${strokeW}px ${preset.outline}` : undefined,
          paintOrder: 'stroke fill',
          textShadow: preset.shadow ? `0 2px ${preset.shadow * 4}px rgba(0,0,0,.45)` : undefined,
          ['--cap-glow-color' as string]: preset.outline,
          transform: isEmph ? `scale(${preset.emphasisScale})` : undefined,
          background:
            animation === 'karaoke' && active
              ? `linear-gradient(90deg, ${activeColor} ${Math.min(100, ((currentTimeSec - w.s) / (w.e - w.s)) * 100)}%, ${preset.primary} 0)`
              : preset.box && (active || isEmph)
                ? preset.box.color
                : undefined,
          WebkitBackgroundClip: animation === 'karaoke' && active ? 'text' : undefined,
          backgroundClip: animation === 'karaoke' && active ? 'text' : undefined,
          padding: preset.box && (active || isEmph) ? `${preset.box.padY}px ${preset.box.padX}px` : undefined,
          borderRadius: preset.box?.radius,
        }

        let content = text
        if (animation === 'typewriter' && active) {
          const progress = Math.min(1, (currentTimeSec - w.s) / Math.max(0.05, w.e - w.s))
          const n = Math.max(1, Math.floor(text.length * progress))
          content = text.slice(0, n)
        }

        return (
          <span
            key={`${w.idx ?? globalIdx}-${w.s}`}
            className={`inline-block px-1 ${active ? animClass(animation) : ''}`}
            style={style}
          >
            {content}
          </span>
        )
      })}
    </div>
  )
}

export function CaptionMiniPreview({ preset, label = 'CLIP THIS' }: { preset: CaptionPreset; label?: string }) {
  const words = label.split(' ').map((w, i) => ({ w, s: i * 0.4, e: (i + 1) * 0.4, idx: i }))
  const edits: ClipEditsV2 = {
    v: 2,
    trim: { in: 0, out: 99999 },
    cutRanges: [],
    wordFixes: {},
    captions: { enabled: true, presetId: preset.slug.replace(/-/g, '_'), animation: preset.animation },
    layout: { mode: 'speaker_follow', shotOverrides: [] },
  }
  return (
    <div className="relative h-16 overflow-hidden rounded-md bg-black/90">
      <CaptionOverlay words={words as ClipWord[]} currentTimeSec={0.5} edits={edits} boxHeightPx={64} />
    </div>
  )
}

'use client'

import type { ClipWord } from '@/lib/clips/edits'

export function CaptionOverlay({
  words,
  currentTimeSec,
  presetId = 'bold_pop',
}: {
  words: ClipWord[]
  currentTimeSec: number
  presetId?: string
}) {
  const activeIdx = words.findIndex((w) => w.s <= currentTimeSec && currentTimeSec < w.e)
  const lineWords = words.slice(Math.max(0, activeIdx - 1), activeIdx + 3)
  if (!lineWords.length) return null

  return (
    <div
      className="pointer-events-none absolute inset-x-2 bottom-[12%] flex flex-wrap justify-center gap-1 text-center"
      data-preset={presetId}
    >
      {lineWords.map((w, i) => {
        const globalIdx = Math.max(0, activeIdx - 1) + i
        const active = globalIdx === activeIdx
        return (
          <span
            key={`${w.s}-${globalIdx}`}
            className={
              active
                ? 'rounded-md bg-yellow-400 px-2 py-1 text-lg font-extrabold uppercase text-black shadow-md'
                : 'rounded-md bg-black/50 px-2 py-1 text-base font-bold text-white'
            }
          >
            {w.w}
          </span>
        )
      })}
    </div>
  )
}

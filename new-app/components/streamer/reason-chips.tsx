'use client'

import { FileText, MessageSquare, Scissors, Sparkles, Volume2 } from 'lucide-react'

type Reason = { kind: string; label: string; value?: string }

const ICONS: Record<string, typeof Volume2> = {
  audio: Volume2,
  chat: MessageSquare,
  chat_call: MessageSquare,
  viewer_clips: Scissors,
  viewer_clip: Scissors,
  transcript: FileText,
  llm: Sparkles,
  streamer_call: Sparkles,
  clip_cue: Sparkles,
}

export function ReasonChips({ reasons, score }: { reasons?: Reason[]; score?: number }) {
  const list = reasons ?? []
  if (!list.length && score == null) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {score != null ? (
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
          {score}
        </span>
      ) : null}
      {list.map((r) => {
        const Icon = ICONS[r.kind] ?? Sparkles
        return (
          <span
            key={`${r.kind}-${r.label}`}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
          >
            <Icon className="h-3 w-3" />
            {r.label}
            {r.value ? ` ${r.value}` : ''}
          </span>
        )
      })}
    </div>
  )
}

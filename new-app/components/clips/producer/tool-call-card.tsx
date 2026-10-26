'use client'

import {
  AudioWaveform,
  Captions,
  Check,
  Clapperboard,
  Film,
  ImagePlus,
  Languages,
  LayoutPanelTop,
  Loader2,
  Music2,
  Palette,
  Scissors,
  SlidersHorizontal,
  Trash2,
  Type,
  Wand2,
  XCircle,
} from 'lucide-react'
import { StatusBadge } from '@/components/app/status'

const TOOL_ICONS: Record<string, typeof Scissors> = {
  trim: Scissors,
  set_captions: Captions,
  set_layout: LayoutPanelTop,
  set_title: Type,
  set_music_mix: SlidersHorizontal,
  add_sfx: AudioWaveform,
  remove_broll: Trash2,
  insert_stock_broll: Film,
  generate_ai_broll: Wand2,
  generate_music: Music2,
  generate_thumbnail: ImagePlus,
  dub: Languages,
  apply_brand: Palette,
}

function iconForSummary(summary: string) {
  const key = Object.keys(TOOL_ICONS).find((k) => summary.toLowerCase().includes(k.replace(/_/g, ' ')) || summary.toLowerCase().includes(k))
  return key ? TOOL_ICONS[key] : Clapperboard
}

export function ToolCallCard({
  summary,
  status = 'done',
  toolName,
}: {
  summary: string
  status?: 'done' | 'pending' | 'failed' | 'paid'
  toolName?: string
}) {
  const Icon = toolName && TOOL_ICONS[toolName] ? TOOL_ICONS[toolName] : iconForSummary(summary)
  const tone = status === 'done' ? 'success' : status === 'failed' ? 'danger' : status === 'paid' ? 'warning' : 'info'
  const statusIcon =
    status === 'done' ? <Check className="size-3" /> : status === 'failed' ? <XCircle className="size-3" /> : <Loader2 className="size-3 animate-spin" />

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2 text-xs font-medium">
        <span className="grid size-7 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-3.5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate">{summary}</span>
        <StatusBadge tone={tone} icon={statusIcon}>
          {status === 'done' ? 'Applied' : status === 'pending' ? 'Running' : status === 'failed' ? 'Failed' : 'Paid'}
        </StatusBadge>
      </div>
    </div>
  )
}

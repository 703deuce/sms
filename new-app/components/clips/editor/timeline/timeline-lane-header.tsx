'use client'

import { Eye, EyeOff, ImageIcon, Lock, Unlock, Volume2, VolumeX } from 'lucide-react'
import { LANE_LABELS, LANE_TOGGLES, type LaneId, type LaneState } from '@/lib/clips/editor/clip-timeline'

const btn =
  'inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40'

/** CapCut-style track header: name + mute / hide / lock (only the toggles the lane supports). */
export function TimelineLaneHeader({
  lane,
  state,
  height,
  onToggle,
  onOpenCover,
}: {
  lane: LaneId
  state: LaneState
  height: number
  onToggle?: (patch: LaneState) => void
  onOpenCover?: () => void
}) {
  const caps = LANE_TOGGLES[lane]
  const name = LANE_LABELS[lane]
  return (
    <div
      className="flex items-center gap-0.5 border-b border-border/40 pl-1.5 pr-1 text-[10px] font-medium text-muted-foreground"
      style={{ height }}
      data-testid={`timeline-lane-header-${lane}`}
    >
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {lane === 'video' && onOpenCover ? (
        <button type="button" className={btn} onClick={onOpenCover} title="Cover / thumbnail" aria-label="Open cover">
          <ImageIcon className="size-3" />
        </button>
      ) : null}
      {caps.mute ? (
        <button
          type="button"
          className={btn}
          disabled={!onToggle}
          onClick={() => onToggle?.({ muted: !state.muted })}
          aria-pressed={Boolean(state.muted)}
          aria-label={`${state.muted ? 'Unmute' : 'Mute'} ${name}`}
          title={`${state.muted ? 'Unmute' : 'Mute'} ${name} (preview + export)`}
          data-testid={`timeline-lane-mute-${lane}`}
        >
          {state.muted ? <VolumeX className="size-3 text-amber-500" /> : <Volume2 className="size-3" />}
        </button>
      ) : null}
      {caps.hide ? (
        <button
          type="button"
          className={btn}
          disabled={!onToggle}
          onClick={() => onToggle?.({ hidden: !state.hidden })}
          aria-pressed={Boolean(state.hidden)}
          aria-label={`${state.hidden ? 'Show' : 'Hide'} ${name}`}
          title={`${state.hidden ? 'Show' : 'Hide'} ${name} (preview + export)`}
          data-testid={`timeline-lane-hide-${lane}`}
        >
          {state.hidden ? <EyeOff className="size-3 text-amber-500" /> : <Eye className="size-3" />}
        </button>
      ) : null}
      <button
        type="button"
        className={btn}
        disabled={!onToggle}
        onClick={() => onToggle?.({ locked: !state.locked })}
        aria-pressed={Boolean(state.locked)}
        aria-label={`${state.locked ? 'Unlock' : 'Lock'} ${name}`}
        title={`${state.locked ? 'Unlock' : 'Lock'} ${name}`}
        data-testid={`timeline-lane-lock-${lane}`}
      >
        {state.locked ? <Lock className="size-3 text-amber-500" /> : <Unlock className="size-3" />}
      </button>
    </div>
  )
}

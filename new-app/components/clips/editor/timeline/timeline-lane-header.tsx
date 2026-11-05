'use client'

import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, ImageIcon, Lock, MoreHorizontal, Unlock, Volume2, VolumeX } from 'lucide-react'
import { LANE_LABELS, LANE_TOGGLES, type LaneId, type LaneState } from '@/lib/clips/editor/clip-timeline'

/** G1b: per-track actions (text / overlay / audio rows). */
export type TrackHeaderActions = {
  onRename?: (name: string) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onAddAbove?: () => void
  onRemove?: () => void
  /** Visual tracks: "up" = toward the front. */
  visual?: boolean
  /** G1c: open this track's effect chain (audio FX / overlay color). */
  onFx?: () => void
  fxOn?: boolean
  /** G1c: open this track's motion (position / scale / crop, keyframable). */
  onMotion?: () => void
  motionOn?: boolean
  /** FV4b: menu label for onMotion (the main Video row says "Main video slot…"). */
  motionLabel?: string
}

const btn =
  'inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 [&_svg]:size-3.5'

/** CapCut-style track header: name + mute / hide / lock (only the toggles the lane supports). */
export function TimelineLaneHeader({
  lane,
  state,
  height,
  onToggle,
  onOpenCover,
  label,
  testKey,
  track,
  dropTarget = false,
  selected = false,
}: {
  lane: LaneId
  selected?: boolean
  state: LaneState
  height: number
  onToggle?: (patch: LaneState) => void
  onOpenCover?: () => void
  /** G1b: track name (defaults to the lane label). */
  label?: string
  /** G1b: test id suffix (extra tracks: `broll-ov2`); defaults to the lane id. */
  testKey?: string
  track?: TrackHeaderActions
  dropTarget?: boolean
}) {
  const caps = LANE_TOGGLES[lane]
  const name = label ?? LANE_LABELS[lane]
  const tk = testKey ?? lane
  return (
    <div
      className={`flex items-center gap-0.5 border-b border-border/40 pl-1.5 pr-1 text-[12px] font-medium text-muted-foreground ${dropTarget ? 'bg-primary/15' : selected ? 'bg-primary/15 ring-1 ring-inset ring-primary/50' : ''}`}
      style={{ height }}
      data-testid={`timeline-lane-header-${tk}`}
    >
      <TrackName name={name} tk={tk} onRename={track?.onRename} />
      {track?.fxOn && track.onFx ? (
        <button type="button" className={`${btn} w-auto px-0.5 text-[11px] font-semibold text-primary`} onClick={track.onFx} title="Track FX" data-testid={`timeline-track-fx-badge-${tk}`}>
          FX
        </button>
      ) : null}
      {track?.motionOn && track.onMotion ? (
        <button type="button" className={`${btn} w-auto px-0.5 text-[11px] font-semibold text-primary`} onClick={track.onMotion} title="Track motion" data-testid={`timeline-track-motion-badge-${tk}`}>
          TM
        </button>
      ) : null}
      {track ? <TrackMenu tk={tk} name={name} actions={track} /> : null}
      {lane === 'video' && onOpenCover ? (
        <button type="button" className={btn} onClick={onOpenCover} title="Cover / thumbnail" aria-label="Open cover">
          <ImageIcon className="size-3.5" />
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
          data-testid={`timeline-lane-mute-${tk}`}
        >
          {state.muted ? <VolumeX className="size-3.5 text-amber-500" /> : <Volume2 className="size-3.5" />}
        </button>
      ) : null}
      {caps.solo ? (
        <button
          type="button"
          className={`${btn} text-[11px] font-bold ${state.soloed ? 'bg-amber-500/20 text-amber-500' : ''}`}
          disabled={!onToggle}
          onClick={() => onToggle?.({ soloed: !state.soloed })}
          aria-pressed={Boolean(state.soloed)}
          aria-label={`${state.soloed ? 'Unsolo' : 'Solo'} ${name}`}
          title={`${state.soloed ? 'Unsolo' : 'Solo'} ${name}: only soloed audio tracks play (preview + export)`}
          data-testid={`timeline-lane-solo-${tk}`}
        >
          S
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
          data-testid={`timeline-lane-hide-${tk}`}
        >
          {state.hidden ? <EyeOff className="size-3.5 text-amber-500" /> : <Eye className="size-3.5" />}
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
        data-testid={`timeline-lane-lock-${tk}`}
      >
        {state.locked ? <Lock className="size-3.5 text-amber-500" /> : <Unlock className="size-3.5" />}
      </button>
    </div>
  )
}

function TrackName({ name, tk, onRename }: { name: string; tk: string; onRename?: (name: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const cancelledRef = useRef(false)
  if (editing && onRename) {
    return (
      <input
        autoFocus
        className="min-w-0 flex-1 truncate rounded border border-border bg-background px-0.5 text-[12px] text-foreground"
        value={draft}
        maxLength={40}
        aria-label="Track name"
        data-testid={`timeline-track-name-input-${tk}`}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false)
          if (cancelledRef.current) { cancelledRef.current = false; return }
          if (draft.trim() && draft.trim() !== name.trim()) onRename(draft.trim())
        }}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') {
            cancelledRef.current = true
            setDraft(name)
            setEditing(false)
          }
        }}
      />
    )
  }
  return (
    <span
      className="min-w-[96px] max-w-[6.5rem] flex-1 truncate text-[12px] font-medium"
      title={onRename ? `${name} — double-click to rename` : name}
      data-testid={`timeline-track-name-${tk}`}
      onDoubleClick={
        onRename
          ? () => {
              cancelledRef.current = false
              setDraft(name)
              setEditing(true)
            }
          : undefined
      }
    >
      {name}
    </span>
  )
}

function TrackMenu({ tk, name, actions }: { tk: string; name: string; actions: TrackHeaderActions }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open])
  const item = 'block w-full rounded px-2 py-1 text-left hover:bg-muted disabled:pointer-events-none disabled:opacity-40'
  const run = (fn?: () => void) => () => {
    setOpen(false)
    fn?.()
  }
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={btn}
        onClick={() => setOpen((v) => !v)}
        aria-label={`${name} track options`}
        aria-expanded={open}
        title="Track options"
        data-testid={`timeline-track-menu-${tk}`}
      >
        <MoreHorizontal className="size-3.5" />
      </button>
      {open ? (
        <div className="absolute left-0 top-5 z-50 min-w-[150px] rounded-md border border-border bg-popover p-1 text-[11px] font-normal text-foreground shadow-lg" role="menu">
          {actions.onRename ? (
            <button type="button" role="menuitem" className={item} onClick={run(() => {
              const next = window.prompt('Track name', name)
              if (next != null && next.trim() && next.trim() !== name.trim()) actions.onRename?.(next.trim())
            })}>
              Rename…
            </button>
          ) : null}
          {actions.onFx ? (
            <button type="button" role="menuitem" className={item} onClick={run(actions.onFx)} data-testid={`timeline-track-fx-${tk}`}>
              Track FX…
            </button>
          ) : null}
          {actions.onMotion ? (
            <button type="button" role="menuitem" className={item} onClick={run(actions.onMotion)} data-testid={`timeline-track-motion-${tk}`}>
              {actions.motionLabel ?? 'Track motion…'}
            </button>
          ) : null}
          {actions.visual !== undefined ? (
            <>
              <button type="button" role="menuitem" className={item} disabled={!actions.onMoveUp} onClick={run(actions.onMoveUp)} data-testid={`timeline-track-up-${tk}`}>
                {actions.visual ? 'Bring track forward' : 'Move up'}
              </button>
              <button type="button" role="menuitem" className={item} disabled={!actions.onMoveDown} onClick={run(actions.onMoveDown)} data-testid={`timeline-track-down-${tk}`}>
                {actions.visual ? 'Send track backward' : 'Move down'}
              </button>
            </>
          ) : null}
          {actions.onAddAbove ? (
            <button type="button" role="menuitem" className={item} onClick={run(actions.onAddAbove)} data-testid={`timeline-track-add-${tk}`}>
              {actions.visual ? 'Add track above' : 'Add track below'}
            </button>
          ) : null}
          {actions.onRemove ? (
            <button type="button" role="menuitem" className={`${item} text-destructive`} onClick={run(actions.onRemove)} data-testid={`timeline-track-remove-${tk}`}>
              Remove track
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

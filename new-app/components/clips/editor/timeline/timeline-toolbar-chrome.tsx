'use client'

import type { ReactNode } from 'react'
import { toast } from 'sonner'
import {
  Activity,
  Blend,
  Bookmark,
  ChevronDown,
  Command,
  Hand,
  Keyboard,
  Layers,
  Link2,
  Magnet,
  Maximize2,
  MoreHorizontal,
  MousePointer2,
  Pause,
  Plus,
  Redo2,
  Repeat,
  Scissors,
  Square,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FreeToolBadge } from '@/components/clips/ui/free-tool-badge'
import {
  editorIconBtn,
  editorIconBtnActive,
  editorMenuSection,
  editorToolbarDivider,
  editorToolbarGroup,
  editorToolbarRow,
  editorToolbarTextBtn,
} from '@/lib/clips/editor/editor-chrome-tokens'
import { PREVIEW_RATES, setPreviewRate } from '@/lib/clips/editor/preview-rate'
import type { TrimTool } from '@/lib/clips/editor/trim-tools'

const TOOL_ROWS: { id: TrimTool | 'j-cut' | 'l-cut'; label: string; shortcut: string; title: string }[] = [
  { id: 'select', label: 'Select', shortcut: 'V', title: 'Select / trim (V)' },
  { id: 'blade', label: 'Blade', shortcut: 'B', title: 'Blade (B): click a clip to split it there' },
  { id: 'roll', label: 'Roll', shortcut: 'R', title: 'Roll edit (R)' },
  { id: 'slide', label: 'Slide', shortcut: 'U', title: 'Slide (U)' },
  { id: 'slip', label: 'Slip', shortcut: 'Y', title: 'Slip (Y)' },
  { id: 'hand', label: 'Hand', shortcut: 'H', title: 'Hand (H): drag to scroll the timeline' },
  { id: 'j-cut', label: 'J-cut', shortcut: '', title: 'J-cut at playhead cut' },
  { id: 'l-cut', label: 'L-cut', shortcut: '', title: 'L-cut at playhead cut' },
]

function toolIcon(id: TrimTool | 'j-cut' | 'l-cut') {
  if (id === 'blade') return Scissors
  if (id === 'hand') return Hand
  return MousePointer2
}

export type TimelineToolbarChromeProps = {
  editable: boolean
  canUndo: boolean
  canRedo: boolean
  onUndo?: () => void
  onRedo?: () => void
  historySlot: ReactNode
  split: () => void
  freezeFrame: () => void
  freezeDisabled: boolean
  insertGap: () => void
  gapDisabled: boolean
  del: () => void
  deleteDisabled: boolean
  tool: TrimTool
  setTool: (t: TrimTool) => void
  applyJLCut: (kind: 'j' | 'l') => void
  applyNudgeText: (raw: string) => boolean
  snapOn: boolean
  setSnapOn: (v: boolean | ((p: boolean) => boolean)) => void
  magnet: boolean
  toggleOpt: (key: 'magnet' | 'rippleOverlays') => void
  linkOn: boolean
  autoXfade: boolean
  setAutoXfade: (v: boolean | ((p: boolean) => boolean)) => void
  hasBeats: boolean
  beatsOn: boolean
  setBeatsOn: (v: boolean | ((p: boolean) => boolean)) => void
  applyBeatCut: (n: 1 | 2 | 4) => void
  takesMenuBody: ReactNode
  onGapClick: () => void
  xfadeTracks: boolean
  setXfadeTracks: (v: boolean | ((p: boolean) => boolean)) => void
  addTrackMenu: ReactNode
  pacingOpen: boolean
  setPacingOpen: (v: boolean | ((p: boolean) => boolean)) => void
  setHelpOpen: (v: boolean) => void
  envOn: boolean
  setEnvOn: (v: boolean | ((p: boolean) => boolean)) => void
  toggleMarker: () => void
  markerDisabled: boolean
  markerPanel: unknown
  setMarkerPanel: (v: unknown) => void
  markerCount: number
  loopOn: boolean
  toggleLoop: () => void
  previewRate: number
  setPaletteOpen: (v: boolean) => void
  range: [number, number] | null
  joinVisible: boolean
  onJoin: () => void
  selectionCount: number
  openCompound: string | null
  compoundBanner: ReactNode
  zoomOut: () => void
  zoomIn: () => void
  zoomSlider: ReactNode
  zoomLabel: string
  zoomDefault: () => void
  zoomFit: () => void
  onDuplicateFreeze: () => void
}

export function TimelineToolbarChrome(p: TimelineToolbarChromeProps) {
  const activeToolRow = TOOL_ROWS.find((r) => r.id === p.tool) ?? TOOL_ROWS[0]!
  const ActiveIcon = toolIcon(p.tool)

  const toggleBtn = (on: boolean) => `${editorIconBtn} ${on ? editorIconBtnActive : ''}`

  return (
    <div className={`${editorToolbarRow} min-w-0 flex-nowrap justify-between gap-2`} data-testid="timeline-toolbar">
      <div className={`${editorToolbarGroup} min-w-0 shrink`}>
        {p.onUndo ? (
          <button type="button" className={`${editorIconBtn} ${p.canUndo ? "text-foreground hover:text-primary" : "text-muted-foreground opacity-35"}`} onClick={p.onUndo} disabled={!p.canUndo} aria-disabled={!p.canUndo} aria-label="Undo" title="Undo (Ctrl/Cmd+Z)">
            <Undo2 />
          </button>
        ) : null}
        {p.onRedo ? (
          <button type="button" className={`${editorIconBtn} ${p.canRedo ? "text-foreground hover:text-primary" : "text-muted-foreground opacity-35"}`} onClick={p.onRedo} disabled={!p.canRedo} aria-disabled={!p.canRedo} aria-label="Redo" title="Redo (Ctrl/Cmd+Shift+Z)">
            <Redo2 />
          </button>
        ) : null}
        {p.historySlot}
        <span className={editorToolbarDivider} aria-hidden />
        {p.editable ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button type="button" className={editorToolbarTextBtn} data-testid="timeline-tool-trigger" title="Timeline tool">
                  <ActiveIcon />
                  <span className="max-w-[5rem] truncate">{activeToolRow.label}</span>
                  <ChevronDown className="size-3 opacity-60" />
                </button>
              }
            />
            <DropdownMenuContent align="start" className="w-52" data-testid="timeline-tools">
              {TOOL_ROWS.map((row) => (
                <DropdownMenuItem
                  key={row.id}
                  data-testid={row.id === 'j-cut' || row.id === 'l-cut' ? `timeline-${row.id}` : `timeline-tool-${row.id}`}
                  onClick={() => {
                    if (row.id === 'j-cut' || row.id === 'l-cut') p.applyJLCut(row.id === 'j-cut' ? 'j' : 'l')
                    else p.setTool(row.id)
                  }}
                >
                  <span className="flex-1">{row.label}</span>
                  {row.shortcut ? <span className="text-muted-foreground">{row.shortcut}</span> : null}
                  {p.tool === row.id ? <span className="text-primary">✓</span> : null}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5">
                <label className="mb-1 block text-xs text-muted-foreground" htmlFor="timeline-nudge-input">
                  Nudge (frames / time, Enter)
                </label>
                <input
                  id="timeline-nudge-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="±nudge"
                  className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs tabular-nums"
                  title="Nudge the selection — Enter applies"
                  aria-label="Nudge selection by timecode"
                  data-testid="timeline-nudge"
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    e.stopPropagation()
                    const el = e.currentTarget
                    if (p.applyNudgeText(el.value)) el.value = ''
                  }}
                />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <button
          type="button"
          className={editorToolbarTextBtn}
          onClick={p.split}
          disabled={!p.editable}
          aria-label="Split at playhead"
          title="Split at playhead (S)"
          data-testid="timeline-split"
        >
          <Scissors />
          Split
        </button>
        <button
          type="button"
          className={editorToolbarTextBtn}
          onClick={p.del}
          disabled={p.deleteDisabled}
          aria-label="Delete selected"
          title="Delete selected (Del)"
          data-testid="timeline-delete"
        >
          <Trash2 />
          Delete
        </button>
        <button
          type="button"
          className={editorToolbarTextBtn}
          onClick={p.freezeFrame}
          disabled={p.freezeDisabled}
          aria-label="Freeze frame at playhead"
          title="Freeze frame at playhead"
          data-testid="timeline-freeze"
        >
          <Pause />
          Freeze
        </button>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden px-1">
        {p.compoundBanner}
        {p.range ? (
          <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs tabular-nums text-primary" data-testid="timeline-inout-chip">
            In {(p.range[0] / 1000).toFixed(2)} – Out {(p.range[1] / 1000).toFixed(2)} s
          </span>
        ) : null}
        {p.joinVisible ? (
          <button type="button" className={editorToolbarTextBtn} onClick={p.onJoin} data-testid="timeline-join">
            Join
          </button>
        ) : null}
        {p.selectionCount > 1 ? (
          <span className="text-xs text-muted-foreground" data-testid="timeline-selection-count">
            {p.selectionCount} selected
          </span>
        ) : null}
      </div>

      <div className={`${editorToolbarGroup} shrink-0`}>
        <button
          type="button"
          className={`${toggleBtn(p.snapOn)} px-2 ${p.snapOn ? 'ring-2 ring-primary/80 bg-primary/20' : 'border border-border opacity-65'}`}
          onClick={() => p.setSnapOn((v) => !v)}
          aria-pressed={p.snapOn}
          aria-label="Snapping"
          title={p.snapOn ? 'Snapping ON (N): edges lock to playhead and nearby clip boundaries' : 'Snapping OFF (N): edges move freely'}
          data-testid="timeline-snap"
        >
          <Magnet />
          <span className="ml-1 text-[10px] font-semibold">{p.snapOn ? 'Snap on' : 'Snap off'}</span>
        </button>
        {p.editable ? (
          <>
            {p.xfadeTracks && p.autoXfade ? (
              <span className="rounded border border-primary/60 bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary"
                title="Cross-track fades ON: moving one Text, B-roll, or SFX clip to partially overlap another on a different track adds fade keyframes. One clip alone has nothing to fade with."
                data-testid="timeline-xfade-tracks-active">⇅ Fades on</span>
            ) : null}
            <button
              type="button"
              className={toggleBtn(p.magnet)}
              onClick={() => p.toggleOpt('magnet')}
              aria-pressed={p.magnet}
              aria-label="Main track magnet"
              title={p.magnet ? 'Magnet ON: trims and deletes close the gap. Click to leave gaps (for B-roll).' : 'Magnet OFF: trims and deletes leave a gap. Click to close gaps automatically.'}
              data-testid="timeline-magnet"
              style={{ width: 'auto', paddingInline: 6 }}
            >
              <span className="whitespace-nowrap text-[10px] font-semibold">{p.magnet ? 'Magnet on' : 'Magnet off'}</span>
            </button>
            <button
              type="button"
              className={toggleBtn(p.linkOn)}
              onClick={() => p.toggleOpt('rippleOverlays')}
              aria-pressed={p.linkOn}
              aria-label="Link overlays to the main track"
              title="Link overlays (ripple with main)"
              data-testid="timeline-link-overlays"
            >
              <Link2 />
            </button>
            <button
              type="button"
              className={toggleBtn(p.autoXfade)}
              onClick={() => p.setAutoXfade((v) => !v)}
              aria-pressed={p.autoXfade}
              aria-label="Auto-crossfade on overlap"
              title="Auto-crossfade on overlap"
              data-testid="timeline-auto-xfade"
            >
              <Blend />
            </button>
          </>
        ) : null}
        <span className={editorToolbarDivider} aria-hidden />
        <div className={`${editorToolbarGroup} shrink-0`} data-testid="timeline-zoom-controls">
        <button type="button" className={editorIconBtn} onClick={p.zoomOut} aria-label="Zoom out timeline" title="Zoom out (-)" data-testid="timeline-zoom-out">
          <ZoomOut />
        </button>
        {p.zoomSlider}
        <button type="button" className={editorIconBtn} onClick={p.zoomIn} aria-label="Zoom in timeline" title="Zoom in (+)" data-testid="timeline-zoom-in">
          <ZoomIn />
        </button>
        <button type="button" className={editorToolbarTextBtn} onClick={p.zoomDefault} title="Reset zoom" data-testid="timeline-zoom-label">
          {p.zoomLabel}
        </button>
        <button type="button" className={editorToolbarTextBtn} onClick={p.zoomFit} aria-label="Fit timeline to view" title="Fit (0)" data-testid="timeline-zoom-fit">
          <Maximize2 />
          Fit
        </button>
        </div>
        <span className={editorToolbarDivider} aria-hidden />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button type="button" className={editorIconBtn} aria-label="More timeline tools" title="More" data-testid="timeline-more-menu">
                <MoreHorizontal />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="max-h-[min(70vh,520px)] w-56 overflow-y-auto">
            <DropdownMenuGroup>
              <DropdownMenuLabel className={editorMenuSection}>Edit</DropdownMenuLabel>
              <DropdownMenuItem disabled={p.gapDisabled} onClick={p.onGapClick} data-testid="timeline-gap">
                <Square className="size-4" />
                Gap
              </DropdownMenuItem>
              <div role="group" aria-label="Takes" data-testid="timeline-takes-menu">
                {p.editable ? p.takesMenuBody : null}
              </div>
              <DropdownMenuItem
                disabled={!p.hasBeats}
                title={p.hasBeats ? undefined : 'Add music first'}
                onClick={() => p.hasBeats && p.setBeatsOn((v) => !v)}
                data-testid="timeline-beats"
              >
                ♪ Beats {p.beatsOn ? '✓' : ''}
              </DropdownMenuItem>
              <div className="px-2 py-1" title={p.hasBeats ? undefined : 'Add music first'}>
                <select
                  className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs disabled:opacity-50"
                  data-testid="timeline-beat-cut"
                  disabled={!p.hasBeats || !p.editable}
                  defaultValue=""
                  onChange={(e) => {
                    const v = e.target.value
                    e.target.value = ''
                    if (v === '1' || v === '2' || v === '4') p.applyBeatCut(Number(v) as 1 | 2 | 4)
                  }}
                >
                  <option value="" disabled>
                    Cut to beat
                  </option>
                  <option value="1">Every beat</option>
                  <option value="2">Every 2 beats</option>
                  <option value="4">Every 4 beats</option>
                </select>
                <FreeToolBadge />
              </div>
              <DropdownMenuItem onClick={p.onDuplicateFreeze}>
                <Pause className="size-4" />
                Freeze frame
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className={editorMenuSection}>Tracks</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => { p.setXfadeTracks((v) => !v); toast.message(p.xfadeTracks ? "Cross-track fades disabled" : "Cross-track fades enabled") }} disabled={!p.autoXfade} data-testid="timeline-xfade-tracks">
                ⇅ Cross-track fades {p.xfadeTracks ? "✓" : ""}
                <span className="ml-2 block text-[10px] text-muted-foreground">Applies when overlapping two Text, B-roll, or SFX clips on separate tracks</span>
              </DropdownMenuItem>
              {p.addTrackMenu}
              <DropdownMenuItem onClick={() => p.setPacingOpen((v) => !v)} data-testid="timeline-pacing">
                Pacing
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { p.setEnvOn((v) => !v); toast.message(p.envOn ? "Volume and opacity envelopes hidden" : "Volume and opacity envelopes visible on eligible clips") }} data-testid="timeline-envelopes">
                <Activity className="size-4" />
                Envelopes {p.envOn ? "✓" : ""}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className={editorMenuSection}>Markers & loop</DropdownMenuLabel>
              <DropdownMenuItem onClick={p.toggleMarker} disabled={p.markerDisabled} data-testid="timeline-add-marker">
                <Bookmark className="size-4" />
                Marker
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => p.setMarkerPanel(p.markerPanel ? null : { focusId: null })} data-testid="timeline-markers-list">
                Markers ({p.markerCount})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={p.toggleLoop} data-testid="timeline-loop">
                <Repeat className="size-4" />
                Loop {p.loopOn ? "✓" : ""}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className={editorMenuSection}>Speed</DropdownMenuLabel>
              <div className="flex flex-wrap gap-1 px-2 py-1" role="radiogroup" aria-label="Preview speed" data-testid="timeline-preview-rate" data-value={p.previewRate}>
              {PREVIEW_RATES.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={p.previewRate === r}
                  data-testid={`timeline-preview-rate-${r}`}
                  className={`rounded-md px-2 py-1 text-xs tabular-nums ${p.previewRate === r ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                  onClick={() => setPreviewRate(r)}
                >
                  {r}×
                </button>
              ))}
              </div>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => p.setHelpOpen(true)} data-testid="timeline-shortcuts">
              <Keyboard className="size-4" />
              Shortcuts (?)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => p.setPaletteOpen(true)} data-testid="timeline-palette">
              <Command className="size-4" />
              Command palette
            </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

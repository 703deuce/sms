'use client'

/**
 * G1a: one selection-driven inspector (CapCut's right panel). Whatever is selected — on the canvas
 * or on the timeline — shows here with Video / Audio / Speed / Animation / Color tabs. Every control
 * is a plain manual edit (no AI, no credits); the ◇ rows are the same KeyframeInspector the
 * timeline shows (mirrored, not moved), so keyframes edited in either place are the same data.
 */
import { rotateBy90 } from '@/lib/clips/editor/canvas-ops'
import { useEffect, useState, type ReactNode } from 'react'
import { ArrowDownToLine, ArrowUpToLine, ChevronDown, ChevronUp, Crop, Diamond, MoveHorizontal, MoveVertical, RotateCcw, Trash2 } from 'lucide-react'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import {
  CROP_PROPS,
  KEY_PROPS,
  PROP_SPECS,
  deleteKeyframesAt,
  findTrack,
  isMediaLayerTarget,
  keyframeTimes,
  pointAt,
  propsForTarget,
  targetOriginMs,
  toggleKeyframeAt,
  type KeyProp,
  type KeyframeTarget,
} from '@/lib/clips/editor/keyframes'
import { layerFlip, moveInStack, setLayerFlip, stackKindOf, stackMoves, type StackMove } from '@/lib/clips/editor/layer-props'
import { KeyframeInspector } from '@/components/clips/editor/timeline/keyframe-inspector'
import { TextAnimSection } from '@/components/clips/editor/text-anim-section'
import { LayerFxControls } from '@/components/clips/editor/g4/layer-fx-controls'
import type { TextAnim } from '@/lib/clips/render-plan/text-anim'

/** G3b: the selection's in / out / loop preset (B-roll / image / overlay layers and text items). */
function presetFor(edits: ClipEditsV2, target: KeyframeTarget): { anim: TextAnim | undefined; layer: boolean; set: (a: TextAnim | undefined) => ClipEditsV2 } | null {
  const strip = <T extends { anim?: TextAnim }>(it: T, a: TextAnim | undefined): T => {
    const { anim: _old, ...rest } = it
    return (a ? { ...rest, anim: a } : rest) as T
  }
  if (target.startsWith('broll:')) {
    const id = target.slice(6)
    const it = (edits.broll ?? []).find((b) => b.id === id)
    if (!it) return null
    return { anim: it.anim, layer: true, set: (a) => ({ ...edits, broll: (edits.broll ?? []).map((b) => (b.id === id ? strip(b, a) : b)) }) }
  }
  if (target.startsWith('text:')) {
    const id = target.slice(5)
    const it = (edits.textItems ?? []).find((t) => t.id === id)
    if (!it) return null
    return { anim: it.anim, layer: Boolean(it.kind), set: (a) => ({ ...edits, textItems: (edits.textItems ?? []).map((t) => (t.id === id ? strip(t, a) : t)) }) }
  }
  return null
}

export type PropertiesTab = 'video' | 'audio' | 'speed' | 'animation' | 'color'
const TABS: { id: PropertiesTab; label: string }[] = [
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Audio' },
  { id: 'speed', label: 'Speed' },
  { id: 'animation', label: 'Animation' },
  { id: 'color', label: 'Color' },
]
const TRANSFORM: KeyProp[] = ['x', 'y', 'scale', 'rotation', 'opacity']

/** Which tabs apply to a selection (the rest stay visible but disabled, with the reason). */
export function tabsFor(target: KeyframeTarget | null): Record<PropertiesTab, string | null> {
  const off = (why: string) => why
  if (!target) {
    const why = 'Select something in the preview or on the timeline'
    return { video: off(why), audio: off(why), speed: off(why), animation: off(why), color: off(why) }
  }
  if (target === 'voice' || target === 'music') {
    return {
      video: off('Audio-only item'),
      audio: null,
      speed: target === 'voice' ? off('Speed is set per Video item') : off('Music follows the video speed'),
      animation: null,
      color: off('Audio-only item'),
    }
  }
  if (target.startsWith('sfx:')) {
    // G1b3: SFX volume envelope (◇ rows = the timeline envelope).
    const why = 'Audio-only item'
    return { video: off(why), audio: null, speed: off('SFX play at normal speed'), animation: off(why), color: off(why) }
  }
  if (target === 'video') return { video: null, audio: null, speed: null, animation: null, color: null }
  if (target.startsWith('adjust:')) {
    // G4a: an adjustment layer is color / effects only.
    const why = 'Adjustment layers only grade what is below them'
    return { video: off(why), audio: off(why), speed: off(why), animation: off(why), color: null }
  }
  if (target.startsWith('broll:')) {
    return { video: null, audio: off('B-roll is silent in the export'), speed: off('Speed is set per Video item'), animation: null, color: null }
  }
  // text items + hook
  return {
    video: null,
    audio: off('Text has no audio'),
    speed: off('Speed is set per Video item'),
    animation: null,
    color: off('Text colour lives in the Text panel'),
  }
}

export function PropertiesPanel({
  edits,
  target,
  label,
  outputMs,
  onCommit,
  onSeekOutput,
  cropMode,
  onCropModeChange,
  readOnly = false,
  speedSlot,
  colorSlot,
  videoSlot,
  brollSceneSlot,
}: {
  edits: ClipEditsV2
  target: KeyframeTarget | null
  label: string
  outputMs: number
  onCommit: (next: ClipEditsV2) => void
  onSeekOutput: (outputMs: number) => void
  cropMode: boolean
  onCropModeChange: (on: boolean) => void
  readOnly?: boolean
  /** Speed control for the selected Video item (ItemSpeedControl), or null. */
  speedSlot?: ReactNode
  /** Color panel bound to the selection (ColorPanel), or null. */
  colorSlot?: ReactNode
  /** G4c main-video tools (stabilize / scene split / blur regions) under Video for the Video layer. */
  videoSlot?: ReactNode
  /** G4cfix: scene split for the selected B-roll item (rendered under its layer effects). */
  brollSceneSlot?: (id: string) => ReactNode
}) {
  const avail = tabsFor(target)
  const [tab, setTab] = useState<PropertiesTab>('video')
  useEffect(() => {
    if (avail[tab] != null) {
      const first = TABS.find((t) => avail[t.id] == null)
      if (first) setTab(first.id)
    }
  }, [target]) // eslint-disable-line react-hooks/exhaustive-deps
  const origin = target ? targetOriginMs(edits, target) : 0
  const localMs = Math.max(0, outputMs - origin)
  const seekLocal = (t: number) => onSeekOutput(origin + t)

  return (
    <div className="space-y-3 p-3" data-testid="properties-panel" data-target={target ?? ''}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="truncate text-sm font-semibold">{target ? label : 'Properties'}</h2>
        {target ? <span className="text-[10px] text-muted-foreground">Edits at the playhead</span> : null}
      </div>
      <div className="flex gap-0.5 rounded-md border border-border p-0.5" role="tablist" aria-label="Properties">
        {TABS.map((t) => {
          const why = avail[t.id]
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              disabled={why != null}
              title={why ?? t.label}
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded px-1.5 py-1 text-[11px] font-medium disabled:opacity-35 ${tab === t.id && why == null ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              data-testid={`properties-tab-${t.id}`}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      {!target ? (
        <p className="text-xs text-muted-foreground" data-testid="properties-empty">
          Click a layer in the preview (video, B-roll, text, hook) or an item on the timeline. Drag it to move, drag a
          corner to resize, use the round handle to rotate; double-click text to edit it.
        </p>
      ) : tab === 'video' && avail.video == null ? (
        <>
          <VideoTab
            edits={edits}
            target={target}
            label={label}
            localMs={localMs}
            onCommit={onCommit}
            onSeekLocal={seekLocal}
            cropMode={cropMode}
            onCropModeChange={onCropModeChange}
            readOnly={readOnly}
          />
          {target === 'video' && videoSlot ? videoSlot : null}
          {target.startsWith('broll:') && brollSceneSlot ? brollSceneSlot(target.slice('broll:'.length)) : null}
        </>
      ) : tab === 'audio' && avail.audio == null ? (
        <KeyframeInspector
          edits={edits}
          target={target === 'music' || target.startsWith('sfx:') ? target : 'voice'}
          label={target === 'music' ? 'Music' : target.startsWith('sfx:') ? 'SFX' : 'Voice'}
          localMs={target === 'music' || target.startsWith('sfx:') ? localMs : outputMs}
          onCommit={onCommit}
          onSeekLocal={(t) => onSeekOutput((target === 'music' || target.startsWith('sfx:') ? origin : 0) + t)}
          readOnly={readOnly}
          props={['volume']}
        />
      ) : tab === 'speed' && avail.speed == null ? (
        speedSlot ?? <p className="text-xs text-muted-foreground">Select a Video item on the timeline to change its speed.</p>
      ) : tab === 'animation' && avail.animation == null ? (
        <AnimationTab edits={edits} target={target} label={label} localMs={localMs} onCommit={onCommit} onSeekLocal={seekLocal} readOnly={readOnly} />
      ) : tab === 'color' && avail.color == null ? (
        colorSlot ?? null
      ) : null}
    </div>
  )
}

function Section({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <section className="space-y-1.5" data-testid={testId}>
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

const btn =
  'inline-flex h-7 items-center gap-1 rounded border border-border px-2 text-[11px] hover:bg-muted disabled:pointer-events-none disabled:opacity-35'

function VideoTab({
  edits,
  target,
  label,
  localMs,
  onCommit,
  onSeekLocal,
  cropMode,
  onCropModeChange,
  readOnly,
}: {
  edits: ClipEditsV2
  target: KeyframeTarget
  label: string
  localMs: number
  onCommit: (next: ClipEditsV2) => void
  onSeekLocal: (t: number) => void
  cropMode: boolean
  onCropModeChange: (on: boolean) => void
  readOnly: boolean
}) {
  const media = isMediaLayerTarget(target)
  const flip = layerFlip(edits, target)
  const moves = stackMoves(edits, target)
  const kind = stackKindOf(target)
  const resetProps = (props: readonly KeyProp[]) => {
    const keep = (edits.keyframes ?? []).filter((k) => !(k.target === target && props.includes(k.prop)))
    onCommit({ ...edits, keyframes: keep.length ? keep : undefined })
  }
  const order = (m: StackMove) => onCommit(moveInStack(edits, target, m))
  return (
    <div className="space-y-4" data-testid="properties-video">
      <Section title="Transform" testId="properties-transform">
        <KeyframeInspector edits={edits} target={target} label={label} localMs={localMs} onCommit={onCommit} onSeekLocal={onSeekLocal} readOnly={readOnly} props={TRANSFORM} />
        <button type="button" className={btn} disabled={readOnly} onClick={() => resetProps(TRANSFORM)} data-testid="properties-reset-transform">
          <RotateCcw className="size-3" aria-hidden /> Reset transform
        </button>
        <span className="ml-1 inline-flex gap-1">
          <button type="button" className={btn} disabled={readOnly} onClick={() => onCommit(rotateBy90(edits, target, -1))} title="Rotate 90° left" data-testid="properties-rotate-left">
            ↺ 90°
          </button>
          <button type="button" className={btn} disabled={readOnly} onClick={() => onCommit(rotateBy90(edits, target, 1))} title="Rotate 90° right" data-testid="properties-rotate-right">
            ↻ 90°
          </button>
        </span>
      </Section>
      {media ? (
        <Section title="Crop" testId="properties-crop">
          <KeyframeInspector edits={edits} target={target} label="Crop (%)" localMs={localMs} onCommit={onCommit} onSeekLocal={onSeekLocal} readOnly={readOnly} props={CROP_PROPS} />
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className={`${btn} ${cropMode ? 'border-yellow-400 bg-yellow-400/15' : ''}`}
              disabled={readOnly}
              aria-pressed={cropMode}
              onClick={() => onCropModeChange(!cropMode)}
              data-testid="properties-crop-mode"
            >
              <Crop className="size-3" aria-hidden /> {cropMode ? 'Done cropping' : 'Crop on canvas'}
            </button>
            <button type="button" className={btn} disabled={readOnly} onClick={() => resetProps(CROP_PROPS)} data-testid="properties-reset-crop">
              <RotateCcw className="size-3" aria-hidden /> Reset crop
            </button>
          </div>
        </Section>
      ) : null}
      {media ? (
        <Section title="Flip" testId="properties-flip">
          <div className="flex gap-1.5">
            <button
              type="button"
              className={`${btn} ${flip.h ? 'bg-primary text-primary-foreground' : ''}`}
              aria-pressed={flip.h}
              disabled={readOnly}
              onClick={() => onCommit(setLayerFlip(edits, target, 'h', !flip.h))}
              data-testid="properties-flip-h"
            >
              <MoveHorizontal className="size-3" aria-hidden /> Horizontal
            </button>
            <button
              type="button"
              className={`${btn} ${flip.v ? 'bg-primary text-primary-foreground' : ''}`}
              aria-pressed={flip.v}
              disabled={readOnly}
              onClick={() => onCommit(setLayerFlip(edits, target, 'v', !flip.v))}
              data-testid="properties-flip-v"
            >
              <MoveVertical className="size-3" aria-hidden /> Vertical
            </button>
          </div>
        </Section>
      ) : null}
      {target.startsWith('broll:') ? (
        <LayerFxControls
          edits={edits}
          itemId={target.slice('broll:'.length)}
          localMs={localMs}
          isVideo={!(edits.broll ?? []).some((b) => `broll:${b.id}` === target && 'still' in b && b.still)}
          onCommit={onCommit}
          readOnly={readOnly}
        />
      ) : null}
      {kind ? (
        <Section title="Layer order" testId="properties-order">
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={btn} disabled={readOnly || !moves.front} onClick={() => order('front')} data-testid="properties-order-front">
              <ArrowUpToLine className="size-3" aria-hidden /> To front
            </button>
            <button type="button" className={btn} disabled={readOnly || !moves.forward} onClick={() => order('forward')} data-testid="properties-order-forward">
              <ChevronUp className="size-3" aria-hidden /> Forward
            </button>
            <button type="button" className={btn} disabled={readOnly || !moves.backward} onClick={() => order('backward')} data-testid="properties-order-backward">
              <ChevronDown className="size-3" aria-hidden /> Backward
            </button>
            <button type="button" className={btn} disabled={readOnly || !moves.back} onClick={() => order('back')} data-testid="properties-order-back">
              <ArrowDownToLine className="size-3" aria-hidden /> To back
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {moves.front || moves.back
              ? `Re-stacks this ${kind === 'broll' ? 'B-roll' : 'text'} among the ones it overlaps in time.`
              : `Nothing overlaps this ${kind === 'broll' ? 'B-roll' : 'text'} in time.`}{' '}
            Text always draws above B-roll, B-roll above the video.
          </p>
        </Section>
      ) : null}
    </div>
  )
}

function AnimationTab({
  edits,
  target,
  label,
  localMs,
  onCommit,
  onSeekLocal,
  readOnly,
}: {
  edits: ClipEditsV2
  target: KeyframeTarget
  label: string
  localMs: number
  onCommit: (next: ClipEditsV2) => void
  onSeekLocal: (t: number) => void
  readOnly: boolean
}) {
  const props = propsForTarget(target)
  const times = keyframeTimes(edits, target)
  const fmt = (ms: number) => `${(ms / 1000).toFixed(2)}s`
  const allHere = props.every((p) => pointAt(findTrack(edits, target, p), localMs))
  const keyAll = () => {
    let next = edits
    for (const p of props) if (!pointAt(findTrack(next, target, p), localMs)) next = toggleKeyframeAt(next, target, p, localMs)
    onCommit(next)
  }
  const preset = presetFor(edits, target)
  return (
    <div className="space-y-4" data-testid="properties-animation">
      {preset ? (
        <Section title="In / Out / Loop" testId="properties-anim-presets">
          <TextAnimSection layer={preset.layer} anim={preset.anim} onChange={(a) => !readOnly && onCommit(preset.set(a))} />
          <p className="text-[11px] text-muted-foreground">Plays on top of the keyframes; the export burns the same motion.</p>
        </Section>
      ) : null}
      <Section title="Keyframes">
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={btn} disabled={readOnly || allHere} onClick={keyAll} data-testid="properties-key-all">
            <Diamond className="size-3" aria-hidden /> Keyframe all at playhead
          </button>
        </div>
        {times.length ? (
          <ul className="divide-y divide-border/60 rounded border border-border/60 text-[11px]" data-testid="properties-kf-list">
            {times.map((t) => {
              const which = KEY_PROPS.filter((p) => findTrack(edits, target, p)?.points.some((q) => q.tMs === t))
              const on = Math.abs(t - localMs) <= 17
              return (
                <li key={t} className={`flex items-center gap-2 px-2 py-1 ${on ? 'bg-amber-400/10' : ''}`}>
                  <button type="button" className="tabular-nums underline-offset-2 hover:underline" onClick={() => onSeekLocal(t)} data-testid="properties-kf-seek">
                    {fmt(t)}
                  </button>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{which.map((p) => PROP_SPECS[p].label).join(', ')}</span>
                  <button
                    type="button"
                    className="inline-flex size-6 items-center justify-center rounded hover:bg-muted disabled:opacity-35"
                    disabled={readOnly}
                    onClick={() => onCommit(deleteKeyframesAt(edits, target, t))}
                    aria-label={`Delete keyframes at ${fmt(t)}`}
                    data-testid="properties-kf-delete"
                  >
                    <Trash2 className="size-3" aria-hidden />
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No keyframes yet. Press ◇ next to a property (or “Keyframe all”), move the playhead, change the value.</p>
        )}
      </Section>
      <Section title="Properties and easing">
        <KeyframeInspector edits={edits} target={target} label={label} localMs={localMs} onCommit={onCommit} onSeekLocal={onSeekLocal} readOnly={readOnly} props={props} />
      </Section>
    </div>
  )
}

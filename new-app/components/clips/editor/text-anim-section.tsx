'use client'

import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SliderRow } from '@/components/clips/editor/e4/slider-row'
import {
  DUR_DEFAULT,
  DUR_MAX,
  DUR_MIN,
  LAYER_ANIM_TYPES,
  normAnim,
  normLayerAnim,
  PERIOD_DEFAULT,
  PERIOD_MAX,
  PERIOD_MIN,
  TEXT_ANIM_BLOCK_ONLY,
  TEXT_ANIM_IN_TYPES,
  TEXT_ANIM_LOOP_TYPES,
  TEXT_ANIM_UNITS,
  type TextAnim,
  type TextAnimEdge,
  type TextAnimLoopType,
  type TextAnimType,
  type TextAnimUnit,
} from '@/lib/clips/render-plan/text-anim'

/**
 * G3a: CapCut-style In / Out / Loop animation for one text item. Pure manual settings; the ASS is
 * built by render-plan/text-anim.ts (== worker text_anim.py), so the libass preview is the export.
 */
export const IN_LABEL: Record<TextAnimType, string> = {
  fade: 'Fade',
  pop: 'Pop',
  zoom: 'Shrink',
  slide_up: 'Slide up',
  slide_down: 'Slide down',
  slide_left: 'Slide left',
  slide_right: 'Slide right',
  typewriter: 'Typewriter',
}
/** G3afix: an out slide is named (and stored) by the direction it leaves in — text-anim OUT_MOTION. */
export const OUT_LABEL: Record<TextAnimType, string> = { ...IN_LABEL, slide_up: 'Slide up (exit up)', slide_down: 'Slide down (exit down)', slide_left: 'Slide left (exit left)', slide_right: 'Slide right (exit right)' }
const UNIT_LABEL: Record<TextAnimUnit, string> = { block: 'Whole text', line: 'By line', word: 'By word', char: 'By letter' }
const LOOP_LABEL: Record<TextAnimLoopType, string> = { pulse: 'Pulse', bounce: 'Float', wiggle: 'Wiggle', flicker: 'Flicker' }
const NONE = 'none'

export const unitsFor = (type: TextAnimType): TextAnimUnit[] =>
  (TEXT_ANIM_BLOCK_ONLY as readonly string[]).includes(type) ? ['block'] : type === 'typewriter' ? ['char', 'word', 'line'] : [...TEXT_ANIM_UNITS]

/** Next anim after one control changes (null = no animation at all). */
export function patchAnim(anim: TextAnim | undefined, p: Partial<TextAnim> & { clear?: 'in' | 'out' | 'loop' }, layer = false): TextAnim | undefined {
  const next: Record<string, unknown> = { ...(anim ?? {}) }
  if (p.clear) delete next[p.clear]
  for (const k of ['in', 'out', 'loop'] as const) if (p[k]) next[k] = p[k]
  return (layer ? normLayerAnim(next) : normAnim(next)) ?? undefined
}

function EdgeControls({ edge, value, onChange, onLive, layer }: { edge: 'in' | 'out'; value: TextAnimEdge | undefined; onChange: (v: TextAnimEdge | null, key?: string) => void; onLive?: (v: TextAnimEdge) => void; layer: boolean }) {
  const all = edge === 'in' ? IN_LABEL : OUT_LABEL
  const types: readonly TextAnimType[] = layer ? LAYER_ANIM_TYPES : TEXT_ANIM_IN_TYPES
  const labels = Object.fromEntries(types.map((t) => [t, all[t]])) as Record<TextAnimType, string>
  const units = value && !layer ? unitsFor(value.type) : []
  return (
    <div className="space-y-1.5" data-testid={`text-anim-${edge}`}>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">{edge === 'in' ? 'In' : 'Out'}</Label>
          {/* G3afix: `items` so the closed trigger shows the label, not the raw stored value. */}
          <Select
            items={{ [NONE]: 'None', ...labels }}
            value={value?.type ?? NONE}
            onValueChange={(v) => {
              if (!v || v === NONE) return onChange(null)
              const type = v as TextAnimType
              const u = layer ? (['block'] as TextAnimUnit[]) : unitsFor(type)
              onChange({ type, unit: value && u.includes(value.unit) ? value.unit : u[0]!, durMs: value?.durMs ?? (type === 'typewriter' ? 1000 : DUR_DEFAULT) })
            }}
          >
            <SelectTrigger className="h-8 text-xs" data-testid={`text-anim-${edge}-type`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {types.map((t) => (
                <SelectItem key={t} value={t} data-testid={`text-anim-${edge}-type-${t}`}>
                  {labels[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {value && units.length > 1 ? (
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Animate</Label>
            <Select items={UNIT_LABEL} value={value.unit} onValueChange={(v) => v && onChange({ ...value, unit: v as TextAnimUnit })}>
              <SelectTrigger className="h-8 text-xs" data-testid={`text-anim-${edge}-unit`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {units.map((u) => (
                  <SelectItem key={u} value={u}>
                    {UNIT_LABEL[u]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
      {value ? (
        <SliderRow
          label="Duration"
          value={value.durMs}
          min={DUR_MIN}
          max={DUR_MAX}
          step={50}
          format={(v) => `${(v / 1000).toFixed(2)}s`}
          testId={`text-anim-${edge}-dur`}
          onLive={(v) => onLive?.({ ...value, durMs: v })}
          onCommit={(v) => onChange({ ...value, durMs: v }, `anim-${edge}-dur`)}
        />
      ) : null}
    </div>
  )
}

export function TextAnimSection({
  anim,
  onChange,
  onLive,
  layer = false,
}: {
  anim: TextAnim | undefined
  onChange: (anim: TextAnim | undefined, key?: string) => void
  onLive?: (anim: TextAnim | undefined) => void
  /** G3b: a non-text layer (B-roll / image / shape / sticker): whole-layer presets only. */
  layer?: boolean
}) {
  const loop = anim?.loop
  const pa = (a: TextAnim | undefined, p: Parameters<typeof patchAnim>[1]) => patchAnim(a, p, layer)
  return (
    <div className="space-y-2 rounded-md border border-border/60 p-2" data-testid="text-anim" data-layer={layer ? '1' : undefined}>
      <p className="text-xs">Animation</p>
      {(['in', 'out'] as const).map((edge) => (
        <EdgeControls
          key={edge}
          edge={edge}
          value={anim?.[edge]}
          layer={layer}
          onChange={(v, key) => onChange(pa(anim, v ? { [edge]: v } : { clear: edge }), key)}
          onLive={(v) => onLive?.(pa(anim, { [edge]: v }))}
        />
      ))}
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Loop</Label>
        <Select
          items={{ [NONE]: 'None', ...LOOP_LABEL }}
          value={loop?.type ?? NONE}
          onValueChange={(v) => {
            if (!v || v === NONE) return onChange(pa(anim, { clear: 'loop' }))
            onChange(pa(anim, { loop: { type: v as TextAnimLoopType, periodMs: loop?.periodMs ?? PERIOD_DEFAULT } }))
          }}
        >
          <SelectTrigger className="h-8 text-xs" data-testid="text-anim-loop-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>None</SelectItem>
            {TEXT_ANIM_LOOP_TYPES.map((t) => (
              <SelectItem key={t} value={t} data-testid={`text-anim-loop-type-${t}`}>
                {LOOP_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {loop ? (
        <SliderRow
          label="Speed (one cycle)"
          value={loop.periodMs}
          min={PERIOD_MIN}
          max={PERIOD_MAX}
          step={50}
          format={(v) => `${(v / 1000).toFixed(2)}s`}
          testId="text-anim-loop-period"
          onLive={(v) => onLive?.(pa(anim, { loop: { ...loop, periodMs: v } }))}
          onCommit={(v) => onChange(pa(anim, { loop: { ...loop, periodMs: v } }), 'anim-loop-period')}
        />
      ) : null}
    </div>
  )
}

'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { Bold, Italic, Loader2, Plus, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { captionFontStack } from '@/lib/clips/caption-fonts'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { reconcileItemMotion } from '@/lib/clips/editor/keyframes'
import {
  cpIndex,
  DEFAULT_TEXT_STYLE,
  LETTER_SPACING_MAX,
  LETTER_SPACING_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  marksToFlags,
  newProgressItem,
  newShapeItem,
  newStickerItem,
  newTemplateItems,
  newTextItem,
  normalizeTextItems,
  remapMarks,
  STICKER_SIZE_MAX,
  TEXT_FONTS,
  TEXT_MAX_CHARS,
  TEXT_MAX_ITEMS,
  TEXT_PRESETS,
  TEXT_SIZE_MAX,
  TEXT_SIZE_MIN,
  TITLE_TEMPLATES,
  textItemLabel,
  toggleMark,
  type TextAlign,
  type TextItem,
  type TextStyle,
} from '@/lib/clips/editor/text-items'
import { PROGRESS_H_MAX, PROGRESS_H_MIN, PROGRESS_W_MIN, SHAPE_LIBRARY, SHAPE_TYPES, STICKER_TYPES } from '@/lib/clips/render-plan/text-shapes'
import { FONT_MAX_BYTES } from '@/lib/clips/font-parse'
import { deleteWorkspaceFont, uploadWorkspaceFont } from '@/lib/clips/editor/workspace-fonts'
import { useWorkspaceFonts } from '@/components/clips/editor/use-workspace-fonts'
import { assPathToSvg } from '@/components/clips/editor/text-items-preview'
import { SliderRow } from '@/components/clips/editor/e4/slider-row'
import { TextAnimSection } from '@/components/clips/editor/text-anim-section'
import { coalescePush, type CoalesceBurst } from '@/lib/clips/editor/undo-coalesce'
import { toast } from 'sonner'
import { placeOnFreeTrack } from '@/lib/clips/editor/tracks'
import type { ProjectMediaItem } from '@/lib/clips/editor/media-add'
import { TextVoiceoverSection } from '@/components/clips/editor/text-voiceover-section'

const ALIGNS: TextAlign[] = ['left', 'center', 'right']

/** Blank text would drop the item (normalizeTextItems), so blanks stay local until blur reverts them. */
function TextContent({ value, onCommit, inputRef }: { value: string; onCommit: (v: string) => void; inputRef?: RefObject<HTMLTextAreaElement | null> }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return (
    <Textarea
      ref={inputRef}
      value={draft}
      maxLength={TEXT_MAX_CHARS}
      onChange={(e) => {
        setDraft(e.target.value)
        if (e.target.value.trim()) onCommit(e.target.value)
      }}
      onBlur={() => {
        if (!draft.trim()) setDraft(value)
      }}
      className="min-h-[60px] text-sm"
      data-testid="text-content"
    />
  )
}

function fontCss(font: string, family?: string) {
  if (font.startsWith('user:') && family) return `"${family}", ${captionFontStack('Montserrat Black')}`
  return captionFontStack(font === 'Montserrat' ? 'Montserrat Black' : font)
}

const UPLOAD = '__upload__'

/** Small SVG of a library drawing (unit box) for the add buttons. */
function Glyph({ parts, size = 28 }: { parts: [string, string][]; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-40 -40 1080 1080" aria-hidden>
      {parts.map(([c, d], i) => (
        <path key={i} d={assPathToSvg(d)} fill={c} />
      ))}
    </svg>
  )
}

function ColorField({ label, value, onChange, testId }: { label: string; value: string; onChange: (v: string) => void; testId: string }) {
  return (
    <label className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
      {label}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-6 w-10 cursor-pointer rounded border border-border bg-transparent"
        data-testid={testId}
      />
    </label>
  )
}

/**
 * E4 Text (CapCut Text tab): "Add text" at the playhead, a preset grid (the 4 T6 title styles first,
 * then E4 presets), and the inspector for the selected item. Timing is edited on the Text lane
 * (move / trim / split / delete); motion with the timeline keyframe inspector (target text:<id>).
 */
export function TextPanel({
  edits,
  onEdits,
  playheadMs,
  durationMs,
  selectedId,
  onSelect,
  onLive,
  clipId,
  uploadLibraryFiles,
  placeVoiceover,
}: {
  edits: ClipEditsV2
  /** pushHistory=false folds the change into the current undo step (E4fix coalescing). */
  onEdits: (e: ClipEditsV2, pushHistory?: boolean) => void
  playheadMs: number
  durationMs: number
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** E4fix: slider drags preview live (audition) and commit once on release, like the Color panel. */
  onLive?: (e: ClipEditsV2 | null) => void
  clipId?: string
  uploadLibraryFiles?: (files: File[]) => Promise<ProjectMediaItem[]>
  placeVoiceover?: (uploadId: string, atMs: number, durMs: number) => void
}) {
  const items = edits.textItems ?? []
  const sel = items.find((t) => t.id === selectedId) ?? null
  const burst = useRef<CoalesceBurst | null>(null)

  // reconcileItemMotion: a moved item carries its text:<id> keyframes, a deleted one drops them.
  const build = (list: TextItem[]) =>
    reconcileItemMotion(edits, { ...edits, textItems: normalizeTextItems(list, durationMs) })
  /** `key` = the control; a burst on one control (typing, slider keys, color drag) is one undo step. */
  const write = (list: TextItem[], key?: string) => {
    const next = build(list)
    if (!key || !sel) {
      burst.current = null
      onEdits(next)
      return
    }
    const now = Date.now()
    const push = coalescePush(burst.current, `${sel.id}:${key}`, now, JSON.stringify(sel))
    const after = next.textItems?.find((t) => t.id === sel.id)
    burst.current = { key: `${sel.id}:${key}`, at: now, sig: JSON.stringify(after ?? null) }
    onEdits(next, push)
  }
  const patch = (p: Partial<TextItem>, key?: string) =>
    sel && write(items.map((t) => (t.id === sel.id ? { ...t, ...p } : t)), key)
  const patchStyle = (p: Partial<TextStyle>, key?: string) => sel && patch({ style: { ...sel.style, ...p } }, key)
  const livePatch = (p: Partial<TextItem>) =>
    sel && onLive?.(build(items.map((t) => (t.id === sel.id ? { ...t, ...p } : t))))
  const liveStyle = (p: Partial<TextStyle>) => sel && livePatch({ style: { ...sel.style, ...p } })
  const commitPatch = (p: Partial<TextItem>, key: string) => {
    onLive?.(null)
    patch(p, key)
  }
  const commitStyle = (p: Partial<TextStyle>, key: string) => {
    onLive?.(null)
    patchStyle(p, key)
  }


  const add = (presetId = 'basic') => {
    if (items.length >= TEXT_MAX_ITEMS) return
    const id = `t${Date.now().toString(36)}`
    const it = newTextItem(id, playheadMs, durationMs, presetId)
    write([...items, it])
    onSelect(id)
  }
  const newId = (() => {
    let n = 0
    return () => `t${Date.now().toString(36)}${n++ ? `_${n}` : ''}`
  })
  const addItems = (made: TextItem[]) => {
    const room = TEXT_MAX_ITEMS - items.length
    if (room < made.length || !made.length) return
    write([...items, ...made])
    onSelect(made[made.length - 1]!.id)
  }
  // G4b: a title template lands at the playhead on a free text track (never on top of other text).
  const addTemplate = (tid: string) => {
    const made = newTemplateItems(tid, newId(), playheadMs, durationMs)
    if (!made.length || TEXT_MAX_ITEMS - items.length < made.length) return
    burst.current = null
    const built = build([...items, ...made])
    const placed = built.textItems?.filter((t) => made.some((m) => m.id === t.id)) ?? []
    if (!placed.length) return onEdits(built)
    const a = Math.min(...placed.map((t) => t.startMs))
    const b = Math.max(...placed.map((t) => t.endMs))
    onEdits(placeOnFreeTrack(built, 'text', placed.map((t) => t.id), a, b))
    onSelect(made[made.length - 1]!.id)
  }
  const addShape = (type: string) => addItems([newShapeItem(newId()(), type, playheadMs, durationMs)])
  const addSticker = (sid: string) => addItems([newStickerItem(newId()(), sid, playheadMs, durationMs)])
  const addProgress = () => addItems([newProgressItem(newId()(), durationMs)])

  const textRef = useRef<HTMLTextAreaElement | null>(null)
  const toggle = (bit: 1 | 2) => {
    if (!sel) return
    const ta = textRef.current
    const s0 = ta ? cpIndex(sel.text, ta.selectionStart ?? 0) : 0
    const e0 = ta ? cpIndex(sel.text, ta.selectionEnd ?? 0) : 0
    patch({ marks: toggleMark(sel, bit, s0, e0) }, bit === 1 ? 'bold' : 'italic')
  }
  const markOn = (bit: 1 | 2) => {
    if (!sel) return false
    const flags = marksToFlags(sel.marks, Array.from(sel.text).length)
    return flags.length > 0 && flags.every((f) => f & bit)
  }

  const userFonts = useWorkspaceFonts()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [fontMsg, setFontMsg] = useState<string | null>(null)
  const [fontBusy, setFontBusy] = useState(false)
  const onFontFile = async (f: File | undefined) => {
    if (!f) return
    if (f.size > FONT_MAX_BYTES) return setFontMsg('Font file is over 8 MB')
    setFontBusy(true)
    setFontMsg(null)
    const r = await uploadWorkspaceFont(f).catch((e: unknown) => ({ error: String(e) }) as { error: string; font?: undefined; existing?: undefined })
    setFontBusy(false)
    if (r.error || !r.font) return setFontMsg(r.error ?? 'Upload failed')
    setFontMsg(r.existing ? `${r.font.family} is already uploaded — selected it.` : `Uploaded ${r.font.family}.`)
    if (sel && !sel.kind) patchStyle({ font: `user:${r.font.id}`, fontFamily: r.font.family })
  }
  const fontItems: Record<string, string> = {
    ...Object.fromEntries(TEXT_FONTS.map((f) => [f.id, f.label])),
    ...Object.fromEntries(userFonts.fonts.map((f) => [`user:${f.id}`, f.family])),
    ...(sel?.style.font.startsWith('user:') && sel.style.fontFamily ? { [sel.style.font]: sel.style.fontFamily } : {}),
    [UPLOAD]: 'Upload font…',
  }
  const isShape = Boolean(sel?.kind)

  return (
    <div className="space-y-4 p-3 text-sm" data-testid="text-panel">
      <Button className="w-full gap-1.5" size="sm" onClick={() => add()} data-testid="text-add" disabled={items.length >= TEXT_MAX_ITEMS}>
        <Plus className="size-4" aria-hidden />
        Add text at playhead
      </Button>

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Styles</p>
        <div className="grid grid-cols-3 gap-2">
          {TEXT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              data-testid={`text-preset-${p.id}`}
              title={sel && !sel.kind ? `Apply ${p.label} to the selected text` : `Add ${p.label} text`}
              className={cn(
                'grid h-14 place-items-center overflow-hidden rounded-lg border bg-black/80 px-1 text-[13px]',
                sel?.presetId === p.id ? 'border-primary ring-2 ring-primary/20' : 'border-border',
              )}
              onClick={() => (sel && !sel.kind ? patch({ style: { ...p.style }, presetId: p.id }) : add(p.id))}
            >
              <span
                style={{
                  fontFamily: fontCss(p.style.font),
                  fontWeight: TEXT_FONTS.find((f) => f.id === p.style.font)?.weight,
                  color: p.style.color,
                  WebkitTextStroke: p.style.stroke ? `1px ${p.style.stroke.color}` : undefined,
                  background: p.style.box ? p.style.box.color : undefined,
                  padding: p.style.box ? '0 4px' : undefined,
                  textTransform: p.style.case === 'upper' ? 'uppercase' : undefined,
                }}
              >
                {p.label.split(' ')[0]}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Animated titles</p>
        <div className="grid grid-cols-3 gap-2" data-testid="text-templates">
          {TITLE_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              data-testid={`text-template-${t.id}`}
              title={`Add the ${t.label} title at the playhead`}
              disabled={items.length + t.parts.length > TEXT_MAX_ITEMS}
              className="grid h-12 place-items-center overflow-hidden rounded-lg border border-border bg-black/80 px-1 text-[11px] text-white disabled:opacity-40"
              onClick={() => addTemplate(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Shapes &amp; stickers</p>
        <div className="flex flex-wrap gap-1.5" data-testid="text-shapes">
          {SHAPE_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className="grid size-9 place-items-center rounded-md border border-border bg-black/70 disabled:opacity-40"
              title={`Add ${SHAPE_LIBRARY.shapes[t]!.label}`}
              aria-label={`Add ${SHAPE_LIBRARY.shapes[t]!.label}`}
              disabled={items.length >= TEXT_MAX_ITEMS}
              onClick={() => addShape(t)}
              data-testid={`text-shape-${t}`}
            >
              <Glyph parts={[['#FACC15', SHAPE_LIBRARY.shapes[t]!.d]]} size={22} />
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" data-testid="text-stickers">
          {STICKER_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className="grid size-9 place-items-center rounded-md border border-border bg-black/70 disabled:opacity-40"
              title={`Add ${SHAPE_LIBRARY.stickers[t]!.label} sticker`}
              aria-label={`Add ${SHAPE_LIBRARY.stickers[t]!.label} sticker`}
              disabled={items.length >= TEXT_MAX_ITEMS}
              onClick={() => addSticker(t)}
              data-testid={`text-sticker-${t}`}
            >
              <Glyph parts={SHAPE_LIBRARY.stickers[t]!.parts.map((p) => [p.c ?? '#FFFFFF', p.d])} size={24} />
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={addProgress} disabled={items.length >= TEXT_MAX_ITEMS} data-testid="text-add-progress">
          Add progress bar
        </Button>
      </section>

      {items.length ? (
        <section className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">On this clip</p>
          <ul className="space-y-1" data-testid="text-list">
            {items.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1 text-left text-xs',
                    t.id === selectedId ? 'border-primary bg-primary/5' : 'border-border',
                  )}
                  onClick={() => onSelect(t.id === selectedId ? null : t.id)}
                  data-testid={`text-list-item-${t.id}`}
                >
                  <span className="truncate">{textItemLabel(t)}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {(t.startMs / 1000).toFixed(1)}–{(t.endMs / 1000).toFixed(1)}s
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sel ? (
        <section className="space-y-3 border-t pt-3" data-testid="text-inspector" data-kind={sel.kind ?? 'text'}>
          {isShape ? (
            <p className="text-xs font-medium" data-testid="text-shape-title">{textItemLabel(sel)}</p>
          ) : (
            <>
              <div className="flex items-center gap-1" role="toolbar" aria-label="Text style">
                <button
                  type="button"
                  className={cn('inline-flex size-7 items-center justify-center rounded border border-border', markOn(1) && 'bg-accent')}
                  aria-pressed={markOn(1)}
                  title="Bold (selected letters, or all)"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggle(1)}
                  data-testid="text-bold"
                >
                  <Bold className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  className={cn('inline-flex size-7 items-center justify-center rounded border border-border', markOn(2) && 'bg-accent')}
                  aria-pressed={markOn(2)}
                  title="Italic (selected letters, or all)"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggle(2)}
                  data-testid="text-italic"
                >
                  <Italic className="size-3.5" aria-hidden />
                </button>
                <span className="text-[10px] text-muted-foreground">Select letters first, or it applies to all</span>
              </div>
              <TextContent
                key={sel.id}
                value={sel.text}
                inputRef={textRef}
                onCommit={(text) => patch({ text, marks: remapMarks(sel.text, text, sel.marks) }, 'text')}
              />
              {clipId && uploadLibraryFiles && placeVoiceover && sel && !sel.kind ? (
                <TextVoiceoverSection
                  clipId={clipId}
                  text={sel.text}
                  atMs={sel.startMs}
                  uploadLibraryFiles={uploadLibraryFiles}
                  placeVoiceover={placeVoiceover}
                />
              ) : null}
            </>
          )}
          {!isShape ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Font</Label>
                <Select
                  items={fontItems}
                  value={sel.style.font}
                  onValueChange={(v) => {
                    if (!v) return
                    if ((v as string) === UPLOAD) return fileRef.current?.click()
                    const uf = userFonts.fonts.find((f) => `user:${f.id}` === v)
                    if (uf) return patchStyle({ font: v as TextStyle['font'], fontFamily: uf.family })
                    patchStyle({ font: v as TextStyle['font'], fontFamily: undefined })
                  }}
                >
                  <SelectTrigger className="h-8 text-xs" data-testid="text-font">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEXT_FONTS.map((f) => (
                      <SelectItem key={f.id} value={f.id} data-testid={`text-font-${f.id}`}>
                        <span style={{ fontFamily: fontCss(f.id), fontWeight: f.weight }}>{f.label}</span>
                      </SelectItem>
                    ))}
                    {userFonts.fonts.map((f) => (
                      <SelectItem key={f.id} value={`user:${f.id}`} data-testid={`text-font-user-${f.id}`}>
                        <span style={{ fontFamily: fontCss(`user:${f.id}`, f.family) }}>{f.family}</span>
                      </SelectItem>
                    ))}
                    <SelectItem value={UPLOAD} data-testid="text-font-upload">
                      <span className="inline-flex items-center gap-1">
                        <Upload className="size-3" aria-hidden /> Upload font…
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Align</Label>
                <div role="radiogroup" className="flex rounded-md border border-border" data-testid="text-align" data-value={sel.style.align}>
                  {ALIGNS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      role="radio"
                      aria-checked={sel.style.align === a}
                      className={cn('h-8 flex-1 text-[11px] capitalize', sel.style.align === a && 'bg-accent text-foreground')}
                      onClick={() => patchStyle({ align: a })}
                      data-testid={`text-align-${a}`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept=".ttf,.otf,font/ttf,font/otf"
            className="hidden"
            onChange={(e) => {
              void onFontFile(e.target.files?.[0])
              e.target.value = ''
            }}
            data-testid="text-font-file"
          />
          {fontBusy || fontMsg ? (
            <p className="text-[11px] text-muted-foreground" data-testid="text-font-msg" role="status">
              {fontBusy ? 'Uploading font…' : fontMsg}
            </p>
          ) : null}
          {sel.style.font.startsWith('user:') && userFonts.fonts.some((f) => `user:${f.id}` === sel.style.font) ? (
            <button
              type="button"
              className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
              onClick={async () => {
                if (await deleteWorkspaceFont(sel.style.font.slice(5))) setFontMsg('Removed from the font list (this text keeps it).')
              }}
              data-testid="text-font-delete"
            >
              Remove this font from the workspace list
            </button>
          ) : null}

          {sel.kind === 'shape' && sel.shape ? (
            <>
              <SliderRow label="Width" value={sel.shape.w} min={16} max={1920} testId="text-shape-w" onLive={(v) => livePatch({ shape: { ...sel.shape!, w: v } })} onCommit={(v) => commitPatch({ shape: { ...sel.shape!, w: v } }, 'shape-w')} />
              <SliderRow label="Height" value={sel.shape.h} min={16} max={1920} testId="text-shape-h" onLive={(v) => livePatch({ shape: { ...sel.shape!, h: v } })} onCommit={(v) => commitPatch({ shape: { ...sel.shape!, h: v } }, 'shape-h')} />
            </>
          ) : sel.kind === 'progress' && sel.progress ? (
            <>
              <SliderRow label="Width" value={sel.progress.w} min={PROGRESS_W_MIN} max={100} unit="%" testId="text-progress-w" onLive={(v) => livePatch({ progress: { ...sel.progress!, w: v } })} onCommit={(v) => commitPatch({ progress: { ...sel.progress!, w: v } }, 'progress-w')} />
              <SliderRow label="Thickness" value={sel.progress.h} min={PROGRESS_H_MIN} max={PROGRESS_H_MAX} testId="text-progress-h" onLive={(v) => livePatch({ progress: { ...sel.progress!, h: v } })} onCommit={(v) => commitPatch({ progress: { ...sel.progress!, h: v } }, 'progress-h')} />
              <label className="flex items-center justify-between text-xs">
                Track
                <Switch
                  checked={Boolean(sel.progress.track)}
                  onCheckedChange={(c) => patch({ progress: { ...sel.progress!, track: c ? sel.progress!.track ?? '#FFFFFF' : undefined } })}
                  data-testid="text-progress-track"
                />
              </label>
              {sel.progress.track ? (
                <>
                  <ColorField label="Track color" value={sel.progress.track} onChange={(c) => patch({ progress: { ...sel.progress!, track: c } }, 'progress-track')} testId="text-progress-track-color" />
                  <SliderRow label="Track opacity" value={sel.progress.trackOpacity} min={0} max={100} unit="%" testId="text-progress-track-opacity" onLive={(v) => livePatch({ progress: { ...sel.progress!, trackOpacity: v } })} onCommit={(v) => commitPatch({ progress: { ...sel.progress!, trackOpacity: v } }, 'progress-track-op')} />
                </>
              ) : null}
              <p className="text-[11px] text-muted-foreground">Fills left → right over the bar&apos;s length on the Text lane.</p>
            </>
          ) : sel.kind === 'sticker' ? (
            <SliderRow label="Size" value={sel.style.size} min={TEXT_SIZE_MIN} max={STICKER_SIZE_MAX} testId="text-size" onLive={(v) => liveStyle({ size: v })} onCommit={(v) => commitStyle({ size: v }, 'size')} />
          ) : (
            <SliderRow label="Size" value={sel.style.size} min={TEXT_SIZE_MIN} max={TEXT_SIZE_MAX} testId="text-size" onLive={(v) => liveStyle({ size: v })} onCommit={(v) => commitStyle({ size: v }, 'size')} />
          )}
          {!isShape ? (
            <>
              <SliderRow
                label="Letter spacing"
                value={sel.style.letterSpacing ?? 0}
                min={LETTER_SPACING_MIN}
                max={LETTER_SPACING_MAX}
                testId="text-letter-spacing"
                onLive={(v) => liveStyle({ letterSpacing: v || undefined })}
                onCommit={(v) => commitStyle({ letterSpacing: v || undefined }, 'letter-spacing')}
              />
              <SliderRow
                label="Line height"
                value={Math.round((sel.style.lineHeight ?? 1) * 100)}
                min={Math.round(LINE_HEIGHT_MIN * 100)}
                max={Math.round(LINE_HEIGHT_MAX * 100)}
                step={5}
                format={(v) => `${(v / 100).toFixed(2)}×`}
                testId="text-line-height"
                onLive={(v) => liveStyle({ lineHeight: v === 100 ? undefined : v / 100 })}
                onCommit={(v) => commitStyle({ lineHeight: v === 100 ? undefined : v / 100 }, 'line-height')}
              />
            </>
          ) : null}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {sel.kind !== 'sticker' ? (
              <ColorField label={isShape ? 'Fill' : 'Color'} value={sel.style.color} onChange={(c) => patchStyle({ color: c }, 'color')} testId="text-color" />
            ) : null}
            {!isShape ? (
              <label className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                UPPERCASE
                <Switch checked={sel.style.case === 'upper'} onCheckedChange={(c) => patchStyle({ case: c ? 'upper' : 'none' })} data-testid="text-upper" />
              </label>
            ) : null}
          </div>

          {!sel.kind || sel.kind === 'shape' ? (
            <div className="space-y-2 rounded-md border border-border/60 p-2">
              <label className="flex items-center justify-between text-xs">
                Gradient
                <Switch
                  checked={Boolean(sel.style.gradient)}
                  onCheckedChange={(c) => patchStyle({ gradient: c ? sel.style.gradient ?? { from: sel.style.color, to: '#A855F7', dir: 'v' } : undefined })}
                  data-testid="text-gradient"
                />
              </label>
              {sel.style.gradient ? (
                <>
                  <ColorField label="From" value={sel.style.gradient.from} onChange={(c) => patchStyle({ gradient: { ...sel.style.gradient!, from: c } }, 'grad-from')} testId="text-gradient-from" />
                  <ColorField label="To" value={sel.style.gradient.to} onChange={(c) => patchStyle({ gradient: { ...sel.style.gradient!, to: c } }, 'grad-to')} testId="text-gradient-to" />
                  <div role="radiogroup" className="flex rounded-md border border-border" data-testid="text-gradient-dir" data-value={sel.style.gradient.dir}>
                    {(['v', 'h'] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        role="radio"
                        aria-checked={sel.style.gradient!.dir === d}
                        className={cn('h-7 flex-1 text-[11px]', sel.style.gradient!.dir === d && 'bg-accent text-foreground')}
                        onClick={() => patchStyle({ gradient: { ...sel.style.gradient!, dir: d } })}
                        data-testid={`text-gradient-dir-${d}`}
                      >
                        {d === 'v' ? 'Top → bottom' : 'Left → right'}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2 rounded-md border border-border/60 p-2">
            <label className="flex items-center justify-between text-xs">
              Stroke
              <Switch
                checked={Boolean(sel.style.stroke)}
                onCheckedChange={(c) => patchStyle({ stroke: c ? sel.style.stroke ?? DEFAULT_TEXT_STYLE.stroke : undefined })}
                data-testid="text-stroke"
              />
            </label>
            {sel.style.stroke ? (
              <>
                <ColorField label="Stroke color" value={sel.style.stroke.color} onChange={(c) => patchStyle({ stroke: { ...sel.style.stroke!, color: c } }, 'stroke-color')} testId="text-stroke-color" />
                <SliderRow label="Width" value={sel.style.stroke.width} min={1} max={24} testId="text-stroke-width" onLive={(v) => liveStyle({ stroke: { ...sel.style.stroke!, width: v } })} onCommit={(v) => commitStyle({ stroke: { ...sel.style.stroke!, width: v } }, 'stroke-width')} />
              </>
            ) : null}
          </div>

          <div className="space-y-2 rounded-md border border-border/60 p-2">
            <label className="flex items-center justify-between text-xs">
              Shadow
              <Switch
                checked={Boolean(sel.style.shadow)}
                onCheckedChange={(c) => patchStyle({ shadow: c ? sel.style.shadow ?? { color: '#000000', opacity: 70, dist: 6 } : undefined })}
                data-testid="text-shadow"
              />
            </label>
            {sel.style.shadow ? (
              <>
                <ColorField label="Shadow color" value={sel.style.shadow.color} onChange={(c) => patchStyle({ shadow: { ...sel.style.shadow!, color: c } }, 'shadow-color')} testId="text-shadow-color" />
                <SliderRow label="Distance" value={sel.style.shadow.dist} min={1} max={24} testId="text-shadow-dist" onLive={(v) => liveStyle({ shadow: { ...sel.style.shadow!, dist: v } })} onCommit={(v) => commitStyle({ shadow: { ...sel.style.shadow!, dist: v } }, 'shadow-dist')} />
                <SliderRow label="Opacity" value={sel.style.shadow.opacity} min={0} max={100} unit="%" testId="text-shadow-opacity" onLive={(v) => liveStyle({ shadow: { ...sel.style.shadow!, opacity: v } })} onCommit={(v) => commitStyle({ shadow: { ...sel.style.shadow!, opacity: v } }, 'shadow-opacity')} />
              </>
            ) : null}
          </div>

          {!isShape ? (
          <div className="space-y-2 rounded-md border border-border/60 p-2">
            <label className="flex items-center justify-between text-xs">
              Background box
              <Switch
                checked={Boolean(sel.style.box)}
                onCheckedChange={(c) => patchStyle({ box: c ? sel.style.box ?? { color: '#000000', opacity: 80, pad: 16 } : undefined })}
                data-testid="text-box"
              />
            </label>
            {sel.style.box ? (
              <>
                <ColorField label="Box color" value={sel.style.box.color} onChange={(c) => patchStyle({ box: { ...sel.style.box!, color: c } }, 'box-color')} testId="text-box-color" />
                <SliderRow label="Opacity" value={sel.style.box.opacity} min={0} max={100} unit="%" testId="text-box-opacity" onLive={(v) => liveStyle({ box: { ...sel.style.box!, opacity: v } })} onCommit={(v) => commitStyle({ box: { ...sel.style.box!, opacity: v } }, 'box-opacity')} />
                <SliderRow label="Padding" value={sel.style.box.pad} min={0} max={80} testId="text-box-pad" onLive={(v) => liveStyle({ box: { ...sel.style.box!, pad: v } })} onCommit={(v) => commitStyle({ box: { ...sel.style.box!, pad: v } }, 'box-pad')} />
              </>
            ) : null}
          </div>
          ) : null}

          <TextAnimSection
            layer={isShape}
            anim={sel.anim}
            onChange={(anim, key) => {
              onLive?.(null)
              patch({ anim }, key)
            }}
            onLive={(anim) => livePatch({ anim })}
          />

          <SliderRow label="Position X" value={sel.x} min={0} max={100} unit="%" testId="text-x" onLive={(v) => livePatch({ x: v })} onCommit={(v) => commitPatch({ x: v }, 'x')} />
          <SliderRow label="Position Y" value={sel.y} min={0} max={100} unit="%" testId="text-y" onLive={(v) => livePatch({ y: v })} onCommit={(v) => commitPatch({ y: v }, 'y')} />
          <p className="text-[11px] text-muted-foreground">
            Timing: drag / trim it on the Text lane. Move it with keyframes: select it on the timeline.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="w-full gap-1.5 text-destructive"
            data-testid="text-delete"
            onClick={() => {
              write(items.filter((t) => t.id !== sel.id))
              onSelect(null)
            }}
          >
            <Trash2 className="size-4" aria-hidden />
            {isShape ? 'Delete' : 'Delete text'}
          </Button>
        </section>
      ) : null}
    </div>
  )
}

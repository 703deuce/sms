'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { CaptionMiniPreview } from '@/components/clips/editor/caption-overlay'
import { CLIP_EDITOR_CAPTION_FONT_FAMILIES } from '@/components/clips/editor/clip-editor-fonts'
import { findClipFont, waitForClipFont } from '@/lib/clips/font-manifest'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { CAPTION_PRESETS, presetSlugToId, resolveCaptionPreset, resolvePreset } from '@/lib/clips/caption-presets'
import { applyDesignedCaptionPreset } from '@/lib/clips/editor/b2b-caption-apply'
import { PREMIUM_CAPTION_STYLES, applyPremiumCaptionStyle, clearPremiumCaptionStyle } from '@/lib/clips/premium-caption-styles'
import { CAPTION_PRESETS_V2 } from '@/lib/clips/templates/registry'
import { resolveT6CaptionPreset } from '@/lib/clips/caption-v2-bridge'
import { t6CaptionPresetsEnabled } from '@/lib/clips/t6-feature-flags'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { VocabEntry } from '@/lib/clips/clip-export-user-types'
import { wordDisplayText } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'
import { clipsFetch } from '@/lib/clips-api'
import { cn } from '@/lib/utils'
import { useSafeZoneVisible } from '@/lib/clips/use-safe-zone-visible'
import { useWorkspaceFonts } from '@/components/clips/editor/use-workspace-fonts'
import { uploadWorkspaceFont } from '@/lib/clips/editor/workspace-fonts'
import { captionFontDisplayLabel } from '@/lib/clips/caption-user-font'
import { FONT_MAX_BYTES } from '@/lib/clips/font-parse'
import {
  chunksForTranslation,
  linesFromTranslation,
  TRANSLATE_CAPTION_LANGUAGES,
} from '@/lib/clips/caption-translate'
import {
  captionInBottomUnsafeBand,
  moveUpMarginVPct,
} from '@/components/clips/editor/preview-safe-zone'
import type { ExportPlatformId } from '@/lib/clips/export-platform-presets'
import { previewCaptionBottomPct } from '@/lib/clips/caption-safe-area'
import { KeyframeInspector } from '@/components/clips/editor/timeline/keyframe-inspector'
import { keyframeGlobalEditMs } from '@/lib/clips/editor/keyframe-time'
import { CAPTION_PROPS } from '@/lib/clips/editor/motion-schema'
import {
  applyCaptionStyleSnapshot,
  captionStyleSnapshotForSave,
} from '../../../lib/clips/editor/caption-style-snapshot'
import { captionStyleRole, CAPTION_OPT_IN_COPY } from '../../../lib/clips/editor/caption-style-catalog'
import { detectCaptionSyncIssues } from '../../../lib/clips/editor/caption-sync-warning'
import { CaptionSyncWarningBanner } from './caption-sync-warning-banner'

const CAPTION_FONTS = CLIP_EDITOR_CAPTION_FONT_FAMILIES
const CAPTION_FONT_LABELS: Record<string, string> = Object.fromEntries(
  CAPTION_FONTS.map((font) => [font, font]),
)
const UPLOAD_FONT = '__upload__'

function CaptionHexInput({
  label,
  value,
  onCommit,
}: {
  label: string
  value: string
  onCommit: (hex: string) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => {
    setDraft(value)
  }, [value])
  const commit = () => {
    const v = draft.trim()
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) onCommit(v)
    else setDraft(value)
  }
  return (
    <label className="text-xs">
      {label}
      <div className="mt-1 flex gap-1">
        <input
          type="color"
          className="h-8 w-10 shrink-0 cursor-pointer rounded border border-border"
          value={/^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#ffffff'}
          onChange={(e) => onCommit(e.target.value)}
          aria-label={`${label} picker`}
        />
        <Input
          className="h-8 font-mono text-xs"
          value={draft}
          aria-label={`${label} hex`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            }
          }}
        />
      </div>
    </label>
  )
}
const HIGHLIGHT_SWATCHES = ['#FDE047', '#FACC15', '#22C55E', '#38BDF8', '#F472B6', '#FFFFFF'] as const
const ANIMATIONS = ['none', 'pop', 'bounce', 'slideup', 'typewriter', 'karaoke', 'glow'] as const

type CustomPreset = { id: string; name: string; config: Record<string, unknown> }

export function CaptionsPanel({
  clipId,
  edits,
  words = [],
  onWordFix,
  onResetWordFix,
  onChange,
  onApplyBrand,
  onSaveClipTemplate,
  outputMs,
  onEdits,
  onSeekOutput,
  readOnly,
  compactProperties = false,
  aspectSlot,
}: {
  clipId?: string
  edits: ClipEditsV2
  words?: SourceWord[]
  onWordFix?: (index: number, text: string, meta?: { s: number; w: string }) => void
  onResetWordFix?: (index: number) => void
  onChange: (captions: ClipEditsV2['captions']) => void
  onApplyBrand?: () => void
  onSaveClipTemplate?: () => void
  outputMs?: number
  onEdits?: (next: ClipEditsV2) => void
  onSeekOutput?: (ms: number) => void
  readOnly?: boolean
  compactProperties?: boolean
  aspectSlot?: ReactNode
}) {
  const cap = edits.captions ?? {}
  const userFonts = useWorkspaceFonts()
  const fontFileRef = useRef<HTMLInputElement | null>(null)
  const [fontUploadBusy, setFontUploadBusy] = useState(false)
  const [fontSelectionBusy, setFontSelectionBusy] = useState(false)
  const [fontUploadMsg, setFontUploadMsg] = useState<string | null>(null)
  const [editingWordI, setEditingWordI] = useState<number | null>(null)
  const wordFixCommittedRef = useRef(false)
  const presetId = cap.presetId || 'bold_pop'
  const preset = resolveT6CaptionPreset(cap, t6CaptionPresetsEnabled())
  const captionFontValue = cap.font ?? preset.font ?? 'Poppins'
  const [previewFonts, setPreviewFonts] = useState<Set<string>>(() => new Set())
  const [captionFontSearch, setCaptionFontSearch] = useState('')
  const captionFontItems: Record<string, string> = {
    ...CAPTION_FONT_LABELS,
    ...Object.fromEntries(userFonts.fonts.map((f) => [`user:${f.id}`, f.family])),
    [UPLOAD_FONT]: 'Upload font…',
  }
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>([])
  const [customPresetStatus, setCustomPresetStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [vocabulary, setVocabulary] = useState<VocabEntry[]>([])
  const [vocabAutoApply, setVocabAutoApply] = useState(true)
  const [vocabFrom, setVocabFrom] = useState('')
  const [vocabTo, setVocabTo] = useState('')
  const [vocabSpeakAs, setVocabSpeakAs] = useState('')
  const [saveOpen, setSaveOpen] = useState(false)
  const [stylesExpanded, setStylesExpanded] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [translateLang, setTranslateLang] = useState('')
  const [translateBusy, setTranslateBusy] = useState(false)

  const loadCustom = useCallback(async () => {
    try {
      const data = await clipsFetch<{ items: CustomPreset[] }>('/api/clips/caption-presets')
      setCustomPresets(data.items ?? [])
      setCustomPresetStatus('ready')
    } catch {
      setCustomPresets([])
      setCustomPresetStatus('error')
    }
  }, [])

  useEffect(() => {
    void loadCustom()
    void clipsFetch<{ data: { vocabulary?: VocabEntry[]; vocabAutoApply?: boolean } }>(
      '/api/clips/export-user-preferences',
    )
      .then((res) => {
        setVocabulary(res.data?.vocabulary ?? [])
        setVocabAutoApply(res.data?.vocabAutoApply !== false)
      })
      .catch(() => {})
  }, [loadCustom])

  const persistVocab = async (next: VocabEntry[], autoApply = vocabAutoApply) => {
    setVocabulary(next)
    try {
      await clipsFetch('/api/clips/export-user-preferences', {
        method: 'PATCH',
        body: JSON.stringify({ vocabulary: next, vocabAutoApply: autoApply }),
      })
    } catch {
      toast.error('Could not save vocabulary')
    }
  }

  const patch = (partial: Partial<ClipEditsV2['captions']>) => onChange({ ...cap, ...partial })
  const [premiumFontBusy, setPremiumFontBusy] = useState(false)
  const selectPremiumCaption = (id: string) => {
    const style = PREMIUM_CAPTION_STYLES.find(s => s.id === id)
    if (!style || premiumFontBusy) return
    setPremiumFontBusy(true)
    void waitForClipFont(style.font)
      .then(() => onChange(applyPremiumCaptionStyle(cap, id)))
      .catch((error: unknown) => toast.error('Caption font unavailable: ' +
        (error instanceof Error ? error.message : String(error))))
      .finally(() => setPremiumFontBusy(false))
  }
  const [safeZoneVisible, setSafeZoneVisible] = useSafeZoneVisible()
  const exportPlatform = (edits.exportTemplate?.exportPlatformId ?? 'tiktok') as ExportPlatformId
  const marginVPct = previewCaptionBottomPct(cap, 1920)
  const unsafeCaption = captionInBottomUnsafeBand(exportPlatform, 1920, marginVPct)

  const activeWordsPerLine = Number(cap.wordsPerLine ?? preset.wordsPerLine)
  const activeCase = cap.case ?? preset.case
  const activePosition = cap.position ?? preset.position
  const syncWarnings = useMemo(
    () => detectCaptionSyncIssues({ words, edits }),
    [words, edits],
  )

  const suggestEmojis = async () => {
    if (!clipId) return
    try {
      const data = await clipsFetch<{ picks: { wordIndex: number; emoji: string }[] }>(
        `/api/clips/clips/${clipId}/captions/emojis`,
        { method: 'POST', body: '{}' },
      )
      const map: Record<string, string> = { ...(cap.emojiByWord || {}) }
      for (const p of data.picks) {
        map[String(p.wordIndex)] = p.emoji
      }
      patch({ autoEmojis: true, emojiByWord: map })
      toast.success(`Added ${data.picks.length} emoji(s)`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Emoji suggest failed')
    }
  }

  const runTranslate = async () => {
    if (!clipId || !onEdits || !translateLang) return
    const lang = TRANSLATE_CAPTION_LANGUAGES.find((l) => l.code === translateLang)
    if (!lang) return
    const ok = window.confirm(`Replace captions with ${lang.label}? (Undo restores)`)
    if (!ok) return
    setTranslateBusy(true)
    try {
      const chunks = chunksForTranslation(edits, words)
      const data = await clipsFetch<{ lines: string[] }>(`/api/clips/clips/${clipId}/captions/translate`, {
        method: 'POST',
        body: JSON.stringify({
          targetLang: translateLang,
          lines: chunks.map((c) => ({ text: c.text })),
        }),
      })
      const captionLines = linesFromTranslation(chunks, data.lines)
      onEdits({ ...edits, captionLines })
      toast.success(`Captions translated to ${lang.label}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Translate failed')
    } finally {
      setTranslateBusy(false)
    }
  }

  const applyPickedRecipe = (recipe: (typeof CAPTION_PRESETS)[number]) => {
    const selected = () => onChange(applyDesignedCaptionPreset(cap, recipe))
    if (!recipe.slug.startsWith('b2b-')) {
      selected()
      return
    }
    void waitForClipFont(recipe.font)
      .then(selected)
      .catch((error: unknown) => toast.error('Font unavailable: ' + (error instanceof Error ? error.message : String(error))))
  }

  const coreColorSwatches = (
    <div className="grid grid-cols-2 gap-3" data-testid="caption-core-colors">
      <CaptionHexInput label="Speaker 1 active" value={cap.colors?.a || preset.active} onCommit={(a) => patch({ colors: { ...cap.colors, a } })} />
      <CaptionHexInput label="Speaker 2 active" value={cap.colors?.b || preset.activeB} onCommit={(b) => patch({ colors: { ...cap.colors, b } })} />
    </div>
  )

  return (
    <div className="flex flex-col gap-4 p-3">
      {compactProperties ? (
        <section className="space-y-3" data-testid="compact-caption-properties">
          <label className="flex items-center justify-between gap-2 text-sm font-medium">
            Show captions on this video
            <Switch aria-label="Show captions on this video" checked={cap.enabled !== false} onCheckedChange={(v) => patch({ enabled: v })} />
          </label>
          <label className="block space-y-1 text-xs font-medium">
            <span>Template</span>
            <select data-testid="compact-caption-template" className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              value={cap.customPresetId ? `custom:${cap.customPresetId}` : cap.presetConfig?.typographyPresetId ? `premium:${String(cap.presetConfig.typographyPresetId)}` : presetId}
              onChange={(event) => {
                const id = event.target.value
                if (id.startsWith('premium:')) {
                  selectPremiumCaption(id.slice(8))
                  return
                }
                if (id.startsWith('custom:')) {
                  const saved = customPresets.find((p) => p.id === id.slice(7))
                  if (saved) onChange({ ...applyCaptionStyleSnapshot(cap, saved.config), customPresetId: saved.id })
                  return
                }
                const classic = CAPTION_PRESETS.find((p) => presetSlugToId(p.slug) === id)
                if (classic) {
                  applyPickedRecipe(classic)
                } else if (id in CAPTION_PRESETS_V2 && t6CaptionPresetsEnabled()) {
                  onChange({ enabled: cap.enabled !== false, presetId: id, emphasis: cap.emphasis, size: cap.size, position: cap.position })
                }
              }}>
              {CAPTION_PRESETS.map((p) => <option key={p.slug} value={presetSlugToId(p.slug)}>{p.name}</option>)}
              {t6CaptionPresetsEnabled() ? Object.entries(CAPTION_PRESETS_V2).filter(([id, p]) => id.startsWith('cp') && !(p as { deferred?: boolean }).deferred).map(([id, p]) => <option key={id} value={id}>{(p as { name?: string }).name ?? id}</option>) : null}
              <optgroup label="Premium typography">
                {PREMIUM_CAPTION_STYLES.map(s => <option key={s.id} value={`premium:${s.id}`}>{s.name}</option>)}
              </optgroup>
              {customPresets.map((p) => <option key={p.id} value={`custom:${p.id}`}>{p.name}</option>)}
            </select>
          </label>
          <Button type="button" size="sm" variant="outline" onClick={() => setStylesExpanded((v) => !v)} aria-expanded={stylesExpanded} data-testid="compact-caption-see-styles">{stylesExpanded ? 'Hide styles' : 'See all styles'}</Button>
          {coreColorSwatches}
        </section>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Captions</span>
          <Switch checked={cap.enabled !== false} onCheckedChange={(v) => patch({ enabled: v })} />
        </div>
      )}
      <p className="text-xs text-muted-foreground">{CAPTION_OPT_IN_COPY}</p>
      <label className="text-xs font-medium text-muted-foreground">Font</label>
      <Input
        aria-label="Search caption fonts"
        data-testid="caption-font-search"
        placeholder="Search fonts…"
        className="h-8"
        value={captionFontSearch}
        onChange={(event) => setCaptionFontSearch(event.target.value)}
      />
      <Select
        items={captionFontItems}
        value={captionFontValue}
        onValueChange={(font) => {
          if (!font || typeof font !== 'string') return
          if (font === UPLOAD_FONT) return fontFileRef.current?.click()
          if (font.startsWith('user:')) return patch({ font })
          setFontSelectionBusy(true)
          void waitForClipFont(font)
            .then(() => patch({ font }))
            .catch((error: unknown) => toast.error('Font unavailable: ' + (error instanceof Error ? error.message : String(error))))
            .finally(() => setFontSelectionBusy(false))
        }}
      >
        <SelectTrigger disabled={fontSelectionBusy} className="h-9" data-testid="caption-font">
          <SelectValue>{captionFontDisplayLabel(captionFontValue, userFonts.fonts, CAPTION_FONT_LABELS)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {CAPTION_FONTS.filter((f) => f.toLowerCase().includes(captionFontSearch.trim().toLowerCase())).map((f) => (
            <SelectItem
              key={f}
              value={f}
              onPointerEnter={() => {
                if (!previewFonts.has(f)) void waitForClipFont(f).then(() => setPreviewFonts(p => new Set(p).add(f))).catch(() => {})
              }}
              onFocus={() => {
                if (!previewFonts.has(f)) void waitForClipFont(f).then(() => setPreviewFonts(p => new Set(p).add(f))).catch(() => {})
              }}
            >
              <span style={previewFonts.has(f) ? {
                fontFamily: '"' + (findClipFont(f)?.assFamily ?? f).replace(/"/g, '') + '"',
                fontWeight: findClipFont(f)?.cssWeight,
              } : undefined}>{f}</span>
            </SelectItem>
          ))}
          {userFonts.fonts.length ? (
            <>
              <div className="px-2 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground">Your fonts</div>
              {userFonts.fonts.filter((f) => f.family.toLowerCase().includes(captionFontSearch.trim().toLowerCase())).map((f) => (
                <SelectItem key={f.id} value={`user:${f.id}`} data-testid={`caption-font-user-${f.id}`}>
                  {f.family}
                </SelectItem>
              ))}
            </>
          ) : null}
          <SelectItem value={UPLOAD_FONT} data-testid="caption-font-upload">
            <span className="inline-flex items-center gap-1">
              <Upload className="size-3.5" aria-hidden /> Upload font…
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
      {syncWarnings.length ? <CaptionSyncWarningBanner warnings={syncWarnings} /> : null}

      {onWordFix && words.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3" data-testid="caption-word-corrections">
          <p className="text-xs font-medium text-muted-foreground">Caption text</p>
          <p className="text-[11px] text-muted-foreground">Double-click a word to fix spelling without re-timing.</p>
          {onWordFix && editingWordI != null ? (() => {
            const w = words.find((x) => x.i === editingWordI)
            const from = w?.w.trim() ?? ''
            const replaceAllCount = from
              ? words.filter((hit) => hit.w.trim().toLowerCase() === from.toLowerCase()).length
              : 0
            return (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              data-testid="caption-replace-all-misheard"
              onClick={() => {
                if (!w || !onWordFix) return
                const to = window.prompt(`Replace every "${from}" with:`, wordDisplayText(w, edits.wordFixes))
                if (to == null || !to.trim()) return
                for (const hit of words) {
                  if (hit.w.trim().toLowerCase() === from.toLowerCase()) {
                    onWordFix(hit.i, to.trim(), { s: Math.round(hit.s * 1000), w: hit.w })
                  }
                }
                setEditingWordI(null)
                toast.success('Replaced all matches')
              }}
            >
              Replace all {replaceAllCount > 0 ? replaceAllCount : ''}
            </Button>
            )
          })() : null}
          <div className="max-h-40 overflow-y-auto text-sm leading-relaxed">
            {words.map((w) => {
              const display = wordDisplayText(w, edits.wordFixes)
              const fixed = Boolean(edits.wordFixes?.[String(w.i)]?.trim())
              const meta = edits.wordFixMeta?.[String(w.i)]
              if (editingWordI === w.i) {
                return (
                  <span key={w.i} className="mr-1 inline-flex">
                    <input
                      autoFocus
                      className="w-24 rounded-lg border border-border bg-background px-1 py-0.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      defaultValue={display}
                      onFocus={(e) => e.currentTarget.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          wordFixCommittedRef.current = true
                          onWordFix(w.i, e.currentTarget.value, {
                            s: Math.round(w.s * 1000),
                            w: w.w,
                          })
                          setEditingWordI(null)
                        }
                        if (e.key === 'Escape') setEditingWordI(null)
                      }}
                      onBlur={(e) => {
                        if (wordFixCommittedRef.current) {
                          wordFixCommittedRef.current = false
                          setEditingWordI(null)
                          return
                        }
                        onWordFix(w.i, e.target.value, { s: Math.round(w.s * 1000), w: w.w })
                        setEditingWordI(null)
                      }}
                    />
                  </span>
                )
              }
              return (
                <span key={w.i} className="mr-1 inline-flex items-center gap-0.5">
                  <button
                    type="button"
                    className={cn(
                      'rounded px-0.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      fixed && 'bg-primary/15 ring-1 ring-primary/30',
                    )}
                    onDoubleClick={(e) => {
                      e.preventDefault()
                      wordFixCommittedRef.current = false
                      setEditingWordI(w.i)
                    }}
                    title={
                      fixed
                        ? `Corrected from “${meta?.w ?? w.w}”`
                        : 'Double-click to edit'
                    }
                  >
                    {display}
                  </button>
                  {fixed && onResetWordFix ? (
                    <button
                      type="button"
                      className="text-[11px] text-primary"
                      onClick={() => onResetWordFix(w.i)}
                    >
                      Reset
                    </button>
                  ) : null}
                </span>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="space-y-2 rounded-lg border border-border p-3" data-testid="caption-vocabulary">
        <p className="text-xs font-medium text-muted-foreground">My vocabulary</p>
        <ul className="space-y-1 text-sm">
          {vocabulary.map((row) => (
            <li key={row.from.toLowerCase()} className="flex items-center justify-between gap-2">
              <span className="min-w-0 flex-1">
                {row.from} → {row.to}
                {row.speakAs ? (
                  <span className="text-muted-foreground"> · speak as {row.speakAs}</span>
                ) : null}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => void persistVocab(vocabulary.filter((v) => v.from !== row.from))}
              >
                ✕
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Input className="h-8 min-w-[4.5rem] flex-1" placeholder="From" value={vocabFrom} onChange={(e) => setVocabFrom(e.target.value)} />
          <Input className="h-8 min-w-[4.5rem] flex-1" placeholder="To" value={vocabTo} onChange={(e) => setVocabTo(e.target.value)} />
          <Input
            className="h-8 min-w-[4.5rem] flex-1"
            placeholder="Speak as (TTS)"
            value={vocabSpeakAs}
            onChange={(e) => setVocabSpeakAs(e.target.value)}
            data-testid="vocab-speak-as-input"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              const from = vocabFrom.trim()
              const to = vocabTo.trim()
              const speakAs = vocabSpeakAs.trim()
              if (!from || !to) return
              const entry: VocabEntry = speakAs ? { from, to, speakAs } : { from, to }
              void persistVocab([
                ...vocabulary.filter((v) => v.from.toLowerCase() !== from.toLowerCase()),
                entry,
              ])
              setVocabFrom('')
              setVocabTo('')
              setVocabSpeakAs('')
            }}
          >
            Add
          </Button>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <Switch
            checked={vocabAutoApply}
            onCheckedChange={(v) => {
              setVocabAutoApply(v)
              void persistVocab(vocabulary, v)
            }}
          />
          Auto-fix new clips with my vocabulary
        </label>
      </div>

      {(!compactProperties || stylesExpanded) ? (
      <>
      <div className="space-y-2" data-testid="caption-custom-presets">
        <p className="text-xs font-medium text-muted-foreground">Saved styles</p>
        {customPresetStatus === 'loading' ? (
          <p className="text-xs text-muted-foreground">Loading saved styles…</p>
        ) : customPresetStatus === 'error' ? (
          <p className="text-xs text-destructive" role="alert">Could not load saved styles. Try again in a moment.</p>
        ) : customPresets.length ? (
          <ul className="space-y-1">
            {customPresets.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                <button
                  type="button"
                  className="flex-1 rounded-sm text-left text-xs font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() =>
                    onChange({
                      ...applyCaptionStyleSnapshot(cap, p.config),
                      customPresetId: p.id,
                    })
                  }
                >
                  {p.name}
                </button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-destructive"
                  onClick={async () => {
                    if (!window.confirm(`Delete preset "${p.name}"?`)) return
                    try {
                      await clipsFetch(`/api/clips/caption-presets/${p.id}`, { method: 'DELETE' })
                      if (cap.customPresetId === p.id) patch({ customPresetId: undefined })
                      await loadCustom()
                      toast.success('Preset deleted')
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Delete failed')
                    }
                  }}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            Save a style to reuse it on another clip in this workspace.
          </p>
        )}
      </div>
      {t6CaptionPresetsEnabled() ? (
        <div className="space-y-2 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">CP presets (T6)</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(CAPTION_PRESETS_V2)
              .filter(([id, p]) => id.startsWith('cp') && !(p as { deferred?: boolean }).deferred)
              .map(([id, p]) => {
                const active = presetId === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() =>
                      onChange({
                        enabled: cap.enabled !== false,
                        presetId: id,
                        emphasis: cap.emphasis,
                        size: cap.size,
                        position: cap.position,
                      })
                    }
                    className={cn(
                      'rounded-lg border p-2 text-left text-xs',
                      active ? 'border-primary ring-2 ring-primary/20' : 'border-border',
                    )}
                  >
                    {(p as { name?: string }).name ?? id}
                  </button>
                )
              })}
          </div>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <p className="col-span-2 text-xs font-medium text-muted-foreground">Classic</p>
        <p className="col-span-2 text-xs text-muted-foreground">
          Clean White is the clean style. Bold Pop is the modern style. {CAPTION_OPT_IN_COPY}
        </p>
        {CAPTION_PRESETS.map((p) => {
          const id = presetSlugToId(p.slug)
          const active = id === presetId && !cap.presetConfig?.typographyPresetId
          return (
            <button
              key={p.slug}
              type="button"
              onClick={() => applyPickedRecipe(p)}
              className={cn(
                'rounded-lg border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:bg-muted/40',
              )}
            >
              <p className="mb-1 text-xs font-medium">
                {p.name}
                {captionStyleRole(id) ? (
                  <span className="ml-1 font-normal text-muted-foreground">
                    · {captionStyleRole(id)!.roleLabel}
                  </span>
                ) : null}
              </p>
              <CaptionMiniPreview preset={p} />
            </button>
          )
        })}
      </div>

      <section className="space-y-2" data-testid="premium-caption-styles" aria-label="Premium caption typography">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Premium caption typography</p>
        <div className="grid grid-cols-2 gap-2">
          {PREMIUM_CAPTION_STYLES.map(style => (
            <button
              key={style.id}
              type="button"
              disabled={premiumFontBusy}
              data-testid={`premium-caption-${style.id}`}
              aria-label={`Apply ${style.name} caption style`}
              aria-pressed={cap.presetConfig?.typographyPresetId === style.id}
              onClick={() => selectPremiumCaption(style.id)}
              className={cn('min-h-14 rounded-lg border p-2 text-left text-xs focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40',
                cap.presetConfig?.typographyPresetId === style.id ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:bg-muted/40')}
            >
              <span className="block font-semibold">{style.name}</span>
              <span className="text-[11px] text-muted-foreground">{style.font} · {style.wordsPerLine} words/line</span>
            </button>
          ))}
        </div>
      </section>

      </>
      ) : null}

      <label className="text-xs font-medium text-muted-foreground">Animation</label>
      <Select
        value={cap.animation || preset.animation || 'pop'}
        onValueChange={(v) => {
          if (typeof v === 'string') patch({ animation: v })
        }}
      >
        <SelectTrigger className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ANIMATIONS.map((a) => (
            <SelectItem key={a} value={a}>
              {a === 'slideup' ? 'Slide up' : a === 'karaoke' ? 'Karaoke fill' : a.charAt(0).toUpperCase() + a.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <p className="text-xs font-medium text-muted-foreground">Active word</p>
      <div className="flex flex-wrap gap-1">
        {(['color', 'highlight', 'fill'] as const).map((mode) => (
          <Button
            key={mode}
            size="sm"
            variant={(cap.activeStyle ?? 'color') === mode ? 'default' : 'outline'}
            onClick={() => patch({ activeStyle: mode })}
          >
            {mode === 'color' ? 'Color' : mode === 'highlight' ? 'Highlight' : 'Fill'}
          </Button>
        ))}
      </div>
      {(cap.activeStyle ?? 'color') === 'highlight' ? (
        <div className="flex flex-wrap gap-2">
          {HIGHLIGHT_SWATCHES.map((hex) => (
            <button
              key={hex}
              type="button"
              aria-label={hex}
              className={cn(
                'size-7 rounded-full border-2',
                (cap.highlightColor ?? '#FDE047') === hex ? 'border-primary' : 'border-border',
              )}
              style={{ backgroundColor: hex }}
              onClick={() => patch({ highlightColor: hex })}
            />
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <label htmlFor="cap-safe-zone" className="text-sm">
          Show safe zone
        </label>
        <Switch id="cap-safe-zone" checked={safeZoneVisible} onCheckedChange={setSafeZoneVisible} />
      </div>
      {unsafeCaption ? (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-2 text-xs text-foreground">
          <p>Captions sit under {exportPlatform.replace(/_/g, ' ')}&apos;s buttons.</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2 h-7"
            onClick={() => patch({ marginVPct: moveUpMarginVPct(exportPlatform) })}
          >
            Move up
          </Button>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div>
          <label htmlFor="cap-auto-emojis" className="text-sm">Auto emojis</label>
          <p className="text-xs text-muted-foreground">Off until you turn it on.</p>
        </div>
        <Switch id="cap-auto-emojis" checked={!!cap.autoEmojis} onCheckedChange={(v) => patch({ autoEmojis: v })} />
      </div>
      {cap.autoEmojis && clipId ? (
        <Button size="sm" variant="outline" onClick={() => void suggestEmojis()}>Suggest emojis</Button>
      ) : null}

      {clipId && onEdits && words.length ? (
        <div className="flex flex-wrap items-center gap-2" data-testid="captions-translate">
          <Select
            items={TRANSLATE_CAPTION_LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
            value={translateLang}
            onValueChange={(v) => v && setTranslateLang(v)}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Translate…" />
            </SelectTrigger>
            <SelectContent>
              {TRANSLATE_CAPTION_LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            disabled={translateBusy || !translateLang}
            onClick={() => void runTranslate()}
          >
            Translate captions
          </Button>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <label htmlFor="cap-progress-bar" className="text-sm">Progress bar</label>
        <Switch
          id="cap-progress-bar"
          checked={!!cap.progressBar?.enabled}
          onCheckedChange={(v) =>
            patch({
              progressBar: {
                enabled: v,
                color: cap.progressBar?.color || '#FFFFFF',
                position: cap.progressBar?.position || 'bottom',
                thickness: cap.progressBar?.thickness || 8,
              },
            })
          }
        />
      </div>
      {cap.progressBar?.enabled ? (
        <div className="flex flex-wrap gap-2 text-xs">
          <input
            type="color"
            value={cap.progressBar?.color || '#FFFFFF'}
            onChange={(e) => patch({ progressBar: { ...cap.progressBar, enabled: true, color: e.target.value } })}
          />
          {(['top', 'bottom'] as const).map((pos) => (
            <Button
              key={pos}
              size="sm"
              variant={cap.progressBar?.position === pos ? 'default' : 'outline'}
              onClick={() => patch({ progressBar: { ...cap.progressBar, enabled: true, position: pos } })}
            >
              {pos}
            </Button>
          ))}
          <Slider
            className="min-w-[120px] flex-1"
            min={6}
            max={12}
            step={1}
            value={[cap.progressBar?.thickness || 8]}
            onValueChange={(v) => {
              const n = Array.isArray(v) ? v[0] : v
              patch({ progressBar: { ...cap.progressBar, enabled: true, thickness: typeof n === 'number' ? n : 8 } })
            }}
          />
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-sm">Keyword highlight</span>
          <p className="text-xs text-muted-foreground">Off until you turn it on.</p>
        </div>
        <Switch
          checked={!!cap.keywordHighlight}
          onCheckedChange={(v) => patch({ keywordHighlight: v, emphasis: v ? cap.emphasis ?? [] : [] })}
        />
      </div>

      <label className="text-xs font-medium text-muted-foreground">
        Size ({presetId.startsWith('cp') ? (cap.userSizePct ?? preset.sizePct) : (cap.size ?? preset.sizePct)}% of video height)
      </label>
      <Slider
        className="w-full min-w-[140px]"
        min={3}
        max={10}
        step={0.5}
        value={[presetId.startsWith('cp') ? (cap.userSizePct ?? preset.sizePct) : (cap.size ?? preset.sizePct)]}
        onValueChange={(v) => {
          const n = Array.isArray(v) ? v[0] : v
          if (presetId.startsWith('cp')) patch({ userSizePct: typeof n === 'number' ? n : preset.sizePct })
          else patch({ size: typeof n === 'number' ? n : preset.sizePct })
        }}
      />

      <div className="flex gap-2">
        {(['top', 'middle', 'bottom'] as const).map((pos) => (
          <Button
            key={pos}
            size="sm"
            variant={activePosition === pos ? 'default' : 'outline'}
            onClick={() => patch({ position: pos })}
          >
            {pos}
          </Button>
        ))}
      </div>

      {outputMs != null && onEdits && onSeekOutput ? (
        <section className="space-y-1 rounded-lg border border-border p-3" data-testid="caption-keyframes">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Motion keyframes</p>
          <p className="text-[11px] text-muted-foreground">
            Offset and scale burned captions on the output timeline (preview and export use the same ASS tags).
          </p>
          <KeyframeInspector
            edits={edits}
            target="captions"
            label="Captions"
            localMs={keyframeGlobalEditMs(edits, outputMs)}
            onCommit={onEdits}
            onSeekLocal={onSeekOutput}
            readOnly={Boolean(readOnly)}
            props={[...CAPTION_PROPS]}
          />
        </section>
      ) : null}

      <div className="flex gap-2">
        <Button
          size="sm"
          variant={activeCase === 'upper' ? 'default' : 'outline'}
          onClick={() => patch({ case: 'upper' })}
        >
          UPPER
        </Button>
        <Button
          size="sm"
          variant={activeCase === 'sentence' ? 'default' : 'outline'}
          onClick={() => patch({ case: 'sentence' })}
        >
          Sentence
        </Button>
      </div>

      <div className="flex gap-2">
        {[1, 2, 3].map((n) => (
          <Button
            key={n}
            size="sm"
            variant={activeWordsPerLine === n ? 'default' : 'outline'}
            onClick={() => patch({ wordsPerLine: n })}
          >
            {n} / line
          </Button>
        ))}
      </div>


      <input
        ref={fontFileRef}
        type="file"
        accept=".ttf,.otf,font/ttf,font/otf"
        className="hidden"
        data-testid="caption-font-file"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          if (f.size > FONT_MAX_BYTES) {
            setFontUploadMsg('Font file is over 8 MB')
            return
          }
          setFontUploadBusy(true)
          setFontUploadMsg(null)
          void uploadWorkspaceFont(f)
            .then((r) => {
              if (r.error || !r.font) {
                setFontUploadMsg(r.error ?? 'Upload failed')
                return
              }
              patch({ font: `user:${r.font.id}` })
              setFontUploadMsg(
                r.existing ? `${r.font.family} is already uploaded — selected it.` : `Uploaded ${r.font.family}.`,
              )
            })
            .catch((err) => setFontUploadMsg(err instanceof Error ? err.message : 'Upload failed'))
            .finally(() => setFontUploadBusy(false))
        }}
      />
      {fontUploadBusy || fontUploadMsg ? (
        <p className="text-[11px] text-muted-foreground" data-testid="caption-font-msg" role="status">
          {fontUploadBusy ? (
            <>
              <Loader2 className="mr-1 inline size-3 animate-spin" aria-hidden /> Uploading font…
            </>
          ) : (
            fontUploadMsg
          )}
        </p>
      ) : null}

      {!compactProperties ? coreColorSwatches : null}

      <div className="flex flex-wrap gap-2">
        {onApplyBrand ? (
          <Button size="sm" variant="outline" onClick={onApplyBrand}>Apply brand kit</Button>
        ) : null}
        {onSaveClipTemplate ? (
          <Button size="sm" variant="outline" onClick={onSaveClipTemplate}>Save clip template</Button>
        ) : null}
        <Button size="sm" variant="outline" onClick={() => setSaveOpen(true)}>Save style</Button>
      </div>
      {compactProperties && aspectSlot ? <section className="border-t border-border pt-3" data-testid="caption-aspect-layout">{aspectSlot}</section> : null}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save caption style</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Preset name"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            autoFocus
          />
          <DialogFooter className="mt-2">
            <Button size="sm" variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={async () => {
                const name = saveName.trim()
                if (!name) {
                  toast.error('Enter a preset name')
                  return
                }
                try {
                  await clipsFetch('/api/clips/caption-presets', {
                    method: 'POST',
                    body: JSON.stringify({
                      name,
                      config: captionStyleSnapshotForSave(cap),
                    }),
                  })
                  toast.success('Style saved. You can apply it on another clip in this workspace.')
                  setSaveName('')
                  setSaveOpen(false)
                  await loadCustom()
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Save failed')
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

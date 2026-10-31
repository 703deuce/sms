'use client'

import './caption-anim.css'

import { Fragment, useMemo, useRef, useEffect } from 'react'
import type { ClipEditsV2, ClipWord } from '@/lib/clips/edits'
import { wordKey } from '@/lib/clips/edits'
import { activeCaptionWordIndex, captionEmojiForWord, previewCaptionWordIndex } from '@/lib/clips/caption-overlay-active'
import { logEditorDecision } from '@/lib/clips/editor-decision-log'
import { resolveCaptionPreset, type CaptionPreset } from '@/lib/clips/caption-presets'
import { effectiveCaptionEdits, resolveT6CaptionPreset } from '@/lib/clips/caption-v2-bridge'
import { t6CaptionPresetsEnabled } from '@/lib/clips/t6-feature-flags'
import { formatCaptionWord, isSentenceBoundary } from '@/lib/clips/caption-case'
import { captionHighlightContrastText } from '@/lib/clips/caption-active-style'
import { previewCaptionBottomPct, previewCaptionTopPct } from '@/lib/clips/caption-safe-area'
import { captionFontStack, captionFontWeight, previewCaptionStrokePx } from '@/lib/clips/caption-fonts'
import { exportPixelSize } from '@/lib/clips/export-aspect'
import { assEmPerFontsize, captionChunkFit, captionFitConfigForEdits, captionSafeWidthPct } from '@/lib/clips/caption-fit'

/** E4fix: bottom margin (% of frame) of a T6 template caption rect — same as the worker's MarginV. */
export function templateCaptionBottomPct(r: { y: number; h: number; playH: number }): number {
  if (!(r.playH > 0)) return 0
  return (Math.max(0, r.playH - (Math.round(r.y) + Math.round(r.h))) / r.playH) * 100
}

function positionStyle(position: string, marginVPct: number): React.CSSProperties | undefined {
  if (position === 'top') return { top: `${marginVPct}%` }
  if (position === 'middle') return undefined
  return { bottom: `${marginVPct}%` }
}

function positionClass(position: string) {
  if (position === 'middle') return 'top-1/2 -translate-y-1/2'
  return ''
}

function animClass(animation: string) {
  if (animation === 'pop') return 'cap-anim-pop'
  if (animation === 'bounce') return 'cap-anim-bounce'
  if (animation === 'slideup') return 'cap-anim-slideup'
  if (animation === 'glow') return 'cap-anim-glow'
  return ''
}

export function CaptionOverlay({
  words,
  currentTimeSec,
  edits,
  boxHeightPx,
  outputDurationSec = 1,
  templateCaptionRect,
}: {
  words: ClipWord[]
  currentTimeSec: number
  edits: ClipEditsV2
  boxHeightPx: number
  outputDurationSec?: number
  /**
   * E4fix: T6 template mode — the export bottom-anchors captions at the template captionRect
   * (worker `_t6_caption_edits`: \an2, MarginV = playH − (y + h)), ignoring the preset position.
   */
  templateCaptionRect?: { y: number; h: number; playH: number } | null
}) {
  const t6Caps = t6CaptionPresetsEnabled()
  const cap = effectiveCaptionEdits(edits.captions ?? {}, t6Caps)
  const preset = resolveT6CaptionPreset(cap, t6Caps)
  const captionFont = cap.font?.trim() || preset.font
  const animation = (cap.animation || preset.animation) as string
  // E3fix2: chunking, font size, safe width and line breaks mirror the export ASS (caption-fit.ts).
  const aspect = edits.aspectRatio ?? '9:16'
  const fitCfg = useMemo(() => captionFitConfigForEdits(edits.captions ?? {}, t6Caps, aspect), [edits.captions, t6Caps, aspect])
  const wpl = Math.max(1, fitCfg.wordsPerLine)
  const caseMode = (cap.case || preset.case) as string
  const exportPlay = exportPixelSize(edits.aspectRatio ?? '9:16', '720p')
  const exportPlayH = exportPlay.height
  const assScale = boxHeightPx > 0 ? boxHeightPx / exportPlayH : 1
  const emRatio = assEmPerFontsize(fitCfg.font)
  const fontSize = Math.max(12, ((boxHeightPx * fitCfg.fontsize) / fitCfg.refH) * emRatio)
  const colors = cap.colors
  const emphasis = new Set(cap.emphasis ?? [])

  const activeIdx = previewCaptionWordIndex(words, currentTimeSec)
  const lastMissLog = useRef(0)
  useEffect(() => {
    if (activeIdx >= 0 || words.length === 0 || currentTimeSec <= 0.05) return
    const tMs = Math.round(currentTimeSec * 1000)
    const inRange = words.some((w) => w.s * 1000 <= tMs && w.e * 1000 >= tMs)
    if (!inRange) return
    const now = Date.now()
    if (now - lastMissLog.current < 2000) return
    lastMissLog.current = now
    logEditorDecision('caption_active_miss', { timeMs: tMs, wordCount: words.length })
  }, [activeIdx, currentTimeSec, words])
  // G3a: manual caption lines (`ln`) show one caption per line, like the export chunk_words.
  const byLine = words.length > 0 && words.every((w) => (w as { ln?: number }).ln !== undefined)
  const lnOf = (i: number) => (words[i] as { ln?: number } | undefined)?.ln
  let lineStart = activeIdx >= 0 ? Math.floor(activeIdx / wpl) * wpl : 0
  let lineEnd = lineStart + wpl
  if (byLine && activeIdx >= 0) {
    lineStart = activeIdx
    while (lineStart > 0 && lnOf(lineStart - 1) === lnOf(activeIdx)) lineStart--
    lineEnd = activeIdx + 1
    while (lineEnd < words.length && lnOf(lineEnd) === lnOf(activeIdx)) lineEnd++
  }
  const lineWords = useMemo(
    () => words.slice(lineStart, lineEnd),
    [lineStart, lineEnd, words],
  )
  const lineFit = useMemo(
    () =>
      captionChunkFit(
        fitCfg,
        lineWords.map((w, i) => ({ w: w.w, i: w.idx ?? lineStart + i })),
        new Set(cap.emphasis ?? []),
      ),
    [cap.emphasis, fitCfg, lineStart, lineWords],
  )
  const lineRows = useMemo(() => {
    const cuts = [0, ...lineFit.breaks, lineWords.length]
    return cuts.slice(0, -1).map((a, r) => ({ from: a, to: cuts[r + 1]! }))
  }, [lineFit.breaks, lineWords.length])

  const pb = cap.progressBar
  const showProgress = Boolean(pb?.enabled) && outputDurationSec > 0
  const showEmojis = Boolean(cap.autoEmojis)
  const progressPct = showProgress ? Math.min(100, (currentTimeSec / outputDurationSec) * 100) : 0

  const position = templateCaptionRect ? 'bottom' : ((cap.position || preset.position) as string)
  const marginVPct = templateCaptionRect
    ? templateCaptionBottomPct(templateCaptionRect)
    : position === 'top'
      ? previewCaptionTopPct(cap, exportPlayH, exportPlay.width)
      : previewCaptionBottomPct(cap, exportPlayH, exportPlay.width)
  const posStyle = positionStyle(position, marginVPct)
  const captionPosClass = positionClass(position)
  const emojiPosClass =
    position === 'top'
      ? 'top-[14%]'
      : position === 'middle'
        ? 'top-[42%]'
        : 'bottom-[18%]'

  const emojiMap = cap.emojiByWord ?? {}
  const hasEmojiMap = showEmojis && Object.keys(emojiMap).length > 0
  const activeStyle = cap.activeStyle ?? 'color'
  const highlightColor = cap.highlightColor ?? '#FDE047'
  const highlightMode = String((preset as CaptionPreset & { highlightMode?: string }).highlightMode ?? '').toLowerCase()
  // T6.2: CP line background (Boxed Bold / Stage / Light BG) behind every word, like the export ASS.
  const cpBox =
    t6Caps && String(cap.presetId ?? '').startsWith('cp') && preset.box
      ? (preset.box as { color: string; opacity?: number })
      : null
  const cpBoxBg = cpBox ? hexWithAlpha(cpBox.color, cpBox.opacity ?? 0.6) : undefined

  if (activeIdx < 0 && !showProgress && !hasEmojiMap) return null

  return (
    <>
      {showProgress && (
        <div
          data-testid="caption-progress-bar"
          className={`pointer-events-none absolute inset-x-0 z-[24] ${pb?.position === 'top' ? 'top-0' : 'bottom-0'}`}
          style={{ height: pb?.thickness || 8, background: 'rgba(0,0,0,0.25)' }}
        >
          <div
            className="h-full transition-[width] duration-75"
            style={{ width: `${progressPct}%`, background: pb?.color || '#FFFFFF' }}
          />
        </div>
      )}
      {hasEmojiMap
        ? words.map((w, globalIdx) => {
            const emoji = captionEmojiForWord(w, globalIdx, emojiMap)
            if (!emoji) return null
            const idx = wordKey(w) ?? w.idx ?? globalIdx
            if (currentTimeSec < w.s || currentTimeSec >= w.e) return null
            return (
              <div
                key={`cap-emoji-${idx}-${w.s}`}
                data-testid="caption-floating-emoji"
                className={`pointer-events-none absolute inset-x-0 z-[26] flex justify-center ${emojiPosClass}`}
                style={{ fontSize: Math.max(18, fontSize * 1.2), lineHeight: 1 }}
              >
                {emoji}
              </div>
            )
          })
        : null}
      {activeIdx >= 0 && lineWords.length ? (
    <div
      className={`pointer-events-none absolute inset-x-0 z-[25] flex max-w-full flex-col items-center gap-y-0.5 text-center ${captionPosClass}`}
      style={{
        fontFamily: captionFontStack(captionFont),
        fontWeight: captionFontWeight(captionFont, preset.weight),
        maxWidth: `${captionSafeWidthPct(aspect)}%`,
        marginInline: 'auto',
        ...posStyle,
      }}
      data-testid="caption-line"
      data-libass-for="captions"
      data-libass-ghost="all"
      data-breaks={lineFit.breaks.join(',')}
      data-fit-scale={lineFit.scale}
    >
      {lineRows.map((row) => (
      <div
        key={`row${row.from}`}
        // EP1 (interim M3): words are separated by a real space at the caption font size, like
        // libass (Poppins ExtraBold space = 0.19 em). Was `gap-x-1` + `px-1` = 12 CSS px per gap.
        className="max-w-full text-center"
        style={{ fontSize: fontSize * lineFit.scale, lineHeight: 'normal' }}
        data-testid="caption-row"
      >
      {lineWords.slice(row.from, row.to).map((w, ri) => {
        const i = row.from + ri
        const globalIdx = lineStart + i
        const active = globalIdx === activeIdx
        const spk = (w as ClipWord & { spk?: number }).spk ?? 0
        const activeColor =
          spk === 0
            ? colors?.a || preset.active
            : colors?.b || preset.activeB
        const isEmph = emphasis.has(w.idx ?? globalIdx)
        const idx = wordKey(w) ?? globalIdx
        const emoji = showEmojis ? captionEmojiForWord(w, globalIdx, emojiMap) : undefined
        // E3fix2: like the export (captions_ass.disp_words), sentence case restarts at each chunk.
        const prevWord = i > 0 ? lineWords[i - 1]?.w : undefined
        const sentenceStart = caseMode === 'sentence' && isSentenceBoundary(prevWord)
        const text = formatCaptionWord(w.w, caseMode, sentenceStart) + (emoji && !hasEmojiMap ? ` ${emoji}` : '')
        const strokeW = preset.outlineW
        const scaledStroke = previewCaptionStrokePx(strokeW, boxHeightPx, exportPlayH)
        const inactiveColor = preset.slug === 'boxed' ? '#FFFFFF' : preset.primary
        const useFill =
          activeStyle === 'fill' || (activeStyle === 'color' && animation === 'karaoke' && active)
        const useHighlight = activeStyle === 'highlight' && active
        const useT6Box = t6Caps && highlightMode === 'box' && active
        const useT6Underline = t6Caps && highlightMode === 'underline' && active
        const useT6Supersize = t6Caps && highlightMode === 'supersize' && active
        const highlightBg = activeColor || highlightColor
        const contrast = captionHighlightContrastText(highlightBg)
        const style: React.CSSProperties = {
          fontSize: fontSize * lineFit.scale,
          color: useHighlight
            ? contrast
            : active || isEmph
              ? preset.slug === 'boxed' && active && activeStyle === 'color'
                ? '#000000'
                : activeColor
              : inactiveColor,
          WebkitTextStroke:
            useHighlight && active ? undefined : scaledStroke ? `${scaledStroke}px ${preset.outline}` : undefined,
          WebkitTextStrokeWidth:
            useHighlight && active ? undefined : scaledStroke ? `${scaledStroke}px` : undefined,
          WebkitTextStrokeColor:
            useHighlight && active ? undefined : scaledStroke ? preset.outline : undefined,
          paintOrder: 'stroke fill',
          textShadow: preset.shadow ? `0 2px ${preset.shadow * 4}px rgba(0,0,0,.45)` : undefined,
          ['--cap-glow-color' as string]: preset.outline,
          transform: isEmph || useT6Supersize ? `scale(${useT6Supersize ? 1.25 : preset.emphasisScale})` : undefined,
          textDecoration: useT6Underline ? 'underline' : undefined,
          textDecorationThickness: useT6Underline ? '0.12em' : undefined,
          background: cpBoxBg && !(useHighlight || useT6Box)
            ? cpBoxBg
            : useHighlight || useT6Box
            ? highlightBg
              : useFill && active
                ? `linear-gradient(90deg, ${activeColor} ${Math.min(100, ((currentTimeSec - w.s) / (w.e - w.s)) * 100)}%, ${preset.primary} 0)`
                : preset.box && (active || isEmph) && activeStyle === 'color'
                  ? preset.box.color
                  : useT6Box
                    ? preset.active
                    : undefined,
          WebkitBackgroundClip: useFill && active ? 'text' : undefined,
          backgroundClip: useFill && active ? 'text' : undefined,
          padding: cpBoxBg || useHighlight || useT6Box
            ? '0.08em 0.25em'
            : preset.box && (active || isEmph) && activeStyle === 'color'
              ? `${(preset.box.padY * assScale).toFixed(2)}px ${(preset.box.padX * assScale).toFixed(2)}px`
              : undefined,
          borderRadius: useHighlight || useT6Box ? '0.18em' : preset.box?.radius,
        }

        let content = text
        if (animation === 'typewriter' && active) {
          const progress = Math.min(1, (currentTimeSec - w.s) / Math.max(0.05, w.e - w.s))
          const n = Math.max(1, Math.floor(text.length * progress))
          content = text.slice(0, n)
        }

        const rowLen = row.to - row.from
        return (
          <Fragment key={`${w.idx ?? globalIdx}-${w.s}`}>
            {ri > 0 && !cpBoxBg ? ' ' : null}
            <span
              className={`inline-block ${active ? animClass(animation) : ''}`}
              style={style}
              data-testid={emoji ? 'caption-word-emoji' : undefined}
            >
              {content}
              {/* CP line background: the export's box spans the spaces too. */}
              {cpBoxBg && ri < rowLen - 1 ? '\u00a0' : null}
            </span>
          </Fragment>
        )
      })}
      </div>
      ))}
    </div>
      ) : null}
    </>
  )
}

export function CaptionMiniPreview({ preset, label = 'CLIP' }: { preset: CaptionPreset; label?: string }) {
  const words = label.split(' ').map((w, i) => ({ w, s: i * 0.35, e: (i + 1) * 0.35 + 0.15, idx: i }))
  const edits: ClipEditsV2 = {
    v: 2,
    trim: { in: 0, out: 99999 },
    cutRanges: [],
    wordFixes: {},
    captions: {
      enabled: true,
      presetId: preset.slug.replace(/-/g, '_'),
      animation: preset.animation,
      case: preset.case,
      wordsPerLine: preset.wordsPerLine,
    },
    layout: { mode: 'speaker_follow', shotOverrides: [] },
  }
  const previewTimeSec = 0.25
  return (
    <div className="relative h-16 overflow-hidden rounded-md bg-gradient-to-b from-zinc-800 to-zinc-950">
      <CaptionOverlay
        words={words as ClipWord[]}
        currentTimeSec={previewTimeSec}
        edits={edits}
        boxHeightPx={64}
        outputDurationSec={2}
      />
    </div>
  )
}

/** T6.2: '#RRGGBB' + opacity → rgba() for the CP line background. */
function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return hex
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`
}

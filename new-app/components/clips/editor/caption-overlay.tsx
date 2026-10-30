'use client'

import './caption-anim.css'

import { useMemo, useRef, useEffect } from 'react'
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
import { captionFontStack, captionFontWeight, cssEmPerAssFontsize, previewCaptionStrokePx } from '@/lib/clips/caption-fonts'
import { exportPixelSize } from '@/lib/clips/export-aspect'

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
}: {
  words: ClipWord[]
  currentTimeSec: number
  edits: ClipEditsV2
  boxHeightPx: number
  outputDurationSec?: number
}) {
  const t6Caps = t6CaptionPresetsEnabled()
  const cap = effectiveCaptionEdits(edits.captions ?? {}, t6Caps)
  const preset = resolveT6CaptionPreset(cap, t6Caps)
  const captionFont = cap.font?.trim() || preset.font
  const animation = (cap.animation || preset.animation) as string
  const wpl = cap.wordsPerLine ?? preset.wordsPerLine
  const caseMode = (cap.case || preset.case) as string
  const sizePct = cap.size ?? preset.sizePct
  const exportPlayH = exportPixelSize(edits.aspectRatio ?? '9:16', '720p').height
  const assScale = boxHeightPx > 0 ? boxHeightPx / exportPlayH : 1
  const emRatio = cssEmPerAssFontsize(preset.font)
  const fontSize = Math.max(12, (boxHeightPx * sizePct) / 100 * emRatio)
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
  const lineStart = activeIdx >= 0 ? Math.floor(activeIdx / wpl) * wpl : 0
  const lineWords = useMemo(
    () => words.slice(lineStart, lineStart + wpl),
    [lineStart, wpl, words],
  )

  const pb = cap.progressBar
  const showProgress = Boolean(pb?.enabled) && outputDurationSec > 0
  const showEmojis = Boolean(cap.autoEmojis)
  const progressPct = showProgress ? Math.min(100, (currentTimeSec / outputDurationSec) * 100) : 0

  const position = (cap.position || preset.position) as string
  const marginVPct =
    position === 'top'
      ? previewCaptionTopPct(cap, exportPlayH)
      : previewCaptionBottomPct(cap, exportPlayH)
  const posStyle = positionStyle(position, marginVPct)
  const captionPosClass = positionClass(position)
  const playW = exportPixelSize(edits.aspectRatio ?? '9:16', '720p').width
  const inlinePad = `${Math.max((72 / playW) * 100, 10)}%`
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
      className={`pointer-events-none absolute inset-x-0 z-[25] flex max-w-full flex-wrap justify-center gap-x-1 gap-y-0.5 text-center ${captionPosClass}`}
      style={{
        fontFamily: captionFontStack(captionFont),
        fontWeight: captionFontWeight(captionFont, preset.weight),
        columnGap: cpBoxBg ? 0 : undefined,
        paddingInline: inlinePad,
        maxWidth: `${100 - parseFloat(inlinePad) * 2}%`,
        marginInline: 'auto',
        ...posStyle,
      }}
    >
      {lineWords.map((w, i) => {
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
        const prevWord = i > 0 ? lineWords[i - 1]?.w : words[lineStart - 1]?.w
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
          fontSize,
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

        return (
          <span
            key={`${w.idx ?? globalIdx}-${w.s}`}
            className={`inline-block px-1 ${active ? animClass(animation) : ''}`}
            style={style}
            data-testid={emoji ? 'caption-word-emoji' : undefined}
          >
            {content}
          </span>
        )
      })}
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

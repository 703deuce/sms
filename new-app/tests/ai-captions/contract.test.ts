import { describe, expect, it } from 'vitest'
import { captionsRunCredits } from '@/lib/ai-captions/credits'
import { builtinStyles } from '@/lib/ai-captions/styles'
import {
  AI_CAPTIONS_DEFAULT_STYLE_ID,
  BUILTIN_STYLE_IDS,
  CAPTIONS_RUN_CREDITS_PLACEHOLDER,
  editorUrlFor,
  LOW_CONFIDENCE_THRESHOLD,
  srtUrlFor,
} from '@/lib/ai-captions/types'
import { isLowConfidence } from '@/lib/ai-captions/words'
import { groupCaptionLines } from '@/lib/ai-captions/lines'
import { srtFromLines } from '@/lib/ai-captions/srt'
import { vttFromLines } from '@/lib/ai-captions/vtt'
import { captionsOnlyProjectSettings, isCaptionsOnlyProjectSettings, shouldAutoStartUploadAgentBatch } from '@/lib/ai-captions/auto-agent-guard'

describe('ai-captions contract helpers', () => {
  it('defaults to clean_white and lists all 14 built-in presets', () => {
    expect(AI_CAPTIONS_DEFAULT_STYLE_ID).toBe('clean_white')
    const styles = builtinStyles()
    expect(styles).toHaveLength(14)
    expect(styles.map((s) => s.styleId)).toEqual([...BUILTIN_STYLE_IDS])
    expect(styles.every((s) => s.kind === 'builtin')).toBe(true)
    expect(styles.some((s) => s.styleId === 'clean_white' && s.name === 'Clean White')).toBe(true)
  })

  it('uses CAPTIONS_RUN_CREDITS with a placeholder default and never returns a dollar field', () => {
    expect(captionsRunCredits({})).toBe(CAPTIONS_RUN_CREDITS_PLACEHOLDER)
    expect(captionsRunCredits({ CAPTIONS_RUN_CREDITS: '7' })).toBe(7)
    expect(captionsRunCredits({ CAPTIONS_RUN_CREDITS: 'nope' })).toBe(CAPTIONS_RUN_CREDITS_PLACEHOLDER)
    expect(CAPTIONS_RUN_CREDITS_PLACEHOLDER).toBe(10)
  })

  it('flags low-confidence words only when ASR p is present and below 0.5', () => {
    expect(LOW_CONFIDENCE_THRESHOLD).toBe(0.5)
    expect(isLowConfidence(0.21)).toBe(true)
    expect(isLowConfidence(0.5)).toBe(false)
    expect(isLowConfidence(0.9)).toBe(false)
    expect(isLowConfidence(undefined)).toBe(false)
  })

  it('builds the clip-editor Captions tab URL and SRT path', () => {
    expect(editorUrlFor('proj_1', 'clip_1')).toBe('/app/video-editor/proj_1/edit/clip_1?tab=captions')
    expect(srtUrlFor('acr_1')).toBe('/api/ai-captions/runs/acr_1/srt')
  })

  it('groups sentences together and only splits long cues on word boundaries', () => {
    const words = [
      { text: 'Hello', startMs: 0, endMs: 200, lowConfidence: false },
      { text: 'world,', startMs: 200, endMs: 400, lowConfidence: false },
      { text: 'this', startMs: 400, endMs: 550, lowConfidence: false },
      { text: 'is', startMs: 550, endMs: 650, lowConfidence: false },
      { text: 'fine.', startMs: 650, endMs: 900, lowConfidence: false },
      { text: 'Next', startMs: 1600, endMs: 1800, lowConfidence: false },
      { text: 'sentence', startMs: 1800, endMs: 2100, lowConfidence: false },
      { text: 'starts.', startMs: 2100, endMs: 2400, lowConfidence: false },
    ]
    const lines = groupCaptionLines(words)
    expect(lines[0]?.text).toBe('Hello world, this is fine.')
    expect(lines.some((l) => l.text === 'Hello world,')).toBe(false)
    expect(lines.at(-1)?.text).toContain('starts.')
    const long = Array.from({ length: 30 }, (_, i) => ({
      text: `word${i}`,
      startMs: i * 200,
      endMs: i * 200 + 180,
      lowConfidence: false,
    }))
    const split = groupCaptionLines(long)
    expect(split.length).toBeGreaterThan(1)
    expect(split.every((l) => !l.text.includes('wor\nd'))).toBe(true)
    const joined = split.map((l) => l.text).join(' ').split(/\s+/)
    expect(joined).toEqual(long.map((w) => w.text))
    const srt = srtFromLines(split)
    expect(srt).toContain('word0')
    expect(srt).toContain('-->')
    const vtt = vttFromLines(split)
    expect(vtt).toMatch(/^WEBVTT\\n\\n/)
    expect(vtt).toContain('00:00:00.000 --> 00:00:00.180')
    expect(vtt).toContain('word0')
  })

  it('never auto-starts the clipper for a captions-only project, even if autoAgentClipMode is on', () => {
    const leaked = {
      ...captionsOnlyProjectSettings(30 * 60 * 1000),
      autoAgentClipMode: 'clip_unified_v1' as const,
      autoAgentClipSeconds: 60,
    }
    expect(shouldAutoStartUploadAgentBatch(leaked)).toBe(false)
    expect(shouldAutoStartUploadAgentBatch({
      captionsOnly: true,
      autoAgentClipMode: 'clip_story_v1',
    })).toBe(false)
    expect(shouldAutoStartUploadAgentBatch({
      captionsOnly: true,
      autoAgentClipMode: 'clip_moment_v1',
    })).toBe(false)
    // Workspace mode on a normal clipper upload still starts the agent.
    expect(shouldAutoStartUploadAgentBatch({
      autoAgentClipMode: 'clip_unified_v1',
    })).toBe(true)
    // The settings we actually persist never include a clipper mode.
    const saved = captionsOnlyProjectSettings(1_800_000)
    expect(saved.captionsOnly).toBe(true)
    expect(isCaptionsOnlyProjectSettings(saved)).toBe(true)
    expect(isCaptionsOnlyProjectSettings({ captionsOnly: true, autoAgentClipMode: 'clip_unified_v1' })).toBe(true)
    expect(isCaptionsOnlyProjectSettings({ captionsOnly: false })).toBe(false)
    expect(isCaptionsOnlyProjectSettings({ autoAgentClipMode: 'clip_unified_v1' })).toBe(false)
    expect(isCaptionsOnlyProjectSettings(null)).toBe(false)
    expect('autoAgentClipMode' in saved).toBe(false)
    expect(shouldAutoStartUploadAgentBatch(saved)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { buildNleCaptionsSrt, buildNleCaptionsVtt, warpSrtCuesToDisplayMs } from '@/lib/clips/export-nle-captions'
import { buildSrtFromCaptionWords, displayPositionMs } from '@/lib/clips/edits'
import { buildCaptionWords } from '@/lib/clips/caption-words'
import { CLIP_5F19E510_BOUNDS, clip5f19e510Edits } from '@/tests/fixtures/clip-5f19e510-edits'

describe('NLE captions.srt output time', () => {
  const edits = clip5f19e510Edits()
  const bounds = CLIP_5F19E510_BOUNDS
  const words = [
    { i: 0, w: 'Hi', s: 0.4, e: 0.8 },
    { i: 1, w: 'Mid', s: 7.4, e: 7.8 },
    { i: 2, w: 'End', s: 30.237, e: 30.6 },
  ]

  it('warps caption cues through segmentSpeeds (5f19e510)', () => {
    const cw = buildCaptionWords(words, edits)
    expect(cw[0]?.s_ms).toBeCloseTo(400, 0)
    expect(cw[1]?.s_ms).toBeCloseTo(7400, 0)
    const srt = buildNleCaptionsSrt(words, edits, bounds)
    expect(srt).toContain('00:00:01,000')
    expect(srt).toContain('00:00:13,800')
    expect(srt).toContain('00:00:39,290')
    expect(displayPositionMs(edits, 400)).toBeCloseTo(1000, 0)
    expect(displayPositionMs(edits, 7400)).toBeCloseTo(13400, 0)
  })

  it('uses manual captionLines text with displayPositionMs warp', () => {
    const editsWithLines = {
      ...edits,
      captionLines: [{ id: 'cl_custom', text: 'Merged custom cue', startMs: 400, endMs: 7800 }],
    }
    const srt = buildNleCaptionsSrt(words, editsWithLines, bounds)
    expect(srt).toContain('Merged custom cue')
    expect(srt).not.toContain('Hi Mid')
    expect(srt).toContain('00:00:01,000')
    expect(srt).toContain('00:00:13,800')
    expect(srt).not.toContain('00:00:00,400')
  })

  it('VTT uses the same saved word fixes, cuts, case, and speed-warped display clock', () => {
    const edited = {
      ...edits,
      wordFixes: { ...edits.wordFixes, '0': 'Hello edited' },
      captions: { ...edits.captions, case: 'upper' },
    }
    const srt = buildNleCaptionsSrt(words, edited, bounds)
    const vtt = buildNleCaptionsVtt(words, edited, bounds)
    expect(srt).toContain('HELLO EDITED')
    expect(vtt).toContain('HELLO EDITED')
    expect(vtt).not.toContain('Hi')
    expect(vtt).toContain('00:00:01.000')
    expect(vtt).toContain('00:00:13.800')
    expect(vtt).toMatch(/^WEBVTT\n\n/)
  })

  it('VTT preserves manual caption line text and converts only timestamp separators', () => {
    const edited = {
      ...edits,
      captionLines: [{ id: 'cl_custom', text: 'Exact saved caption', startMs: 400, endMs: 7800 }],
    }
    const srt = buildNleCaptionsSrt(words, edited, bounds)
    const vtt = buildNleCaptionsVtt(words, edited, bounds)
    expect(srt).toContain('Exact saved caption')
    expect(vtt).toContain('Exact saved caption')
    expect(vtt).toContain('00:00:01.000 --> 00:00:13.800')
    expect(vtt).not.toContain('00:00:01,000')
  })

  it('warpSrtCuesToDisplayMs matches displayPositionMs on edit-ms SRT', () => {
    const cw = buildCaptionWords(words, edits)
    const editSrt = buildSrtFromCaptionWords(cw)
    const warped = warpSrtCuesToDisplayMs(editSrt, edits)
    expect(warped).toContain('00:00:01,000')
    expect(buildNleCaptionsSrt(words, edits, bounds)).toContain('00:00:01,000')
  })
})

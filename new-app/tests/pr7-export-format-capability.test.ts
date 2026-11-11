import { describe, expect, it } from 'vitest'
import {
  audioFormatOptionLabel,
  effectiveAudioDeliverFormat,
  exportActionLabel,
  exportDownloadLabel,
  mp3EncoderAvailable,
} from '@/lib/clips/export-format-labels'

describe('PR7 XE01: explicit format and honest encoder capabilities', () => {
  it('preserves the selected MP3 format even if an encoder probe reports it missing', () => {
    const withoutMp3 = ['aac', 'pcm_s16le']
    expect(mp3EncoderAvailable(withoutMp3)).toBe(false)
    expect(effectiveAudioDeliverFormat('mp3', withoutMp3)).toBe('mp3')
    expect(exportActionLabel('mp3', withoutMp3)).toBe('Export MP3')
    expect(exportDownloadLabel('mp3', withoutMp3)).toBe('Download MP3')
    expect(audioFormatOptionLabel('mp3', withoutMp3)).toBe('MP3')
  })

  it('keeps an unknown encoder probe distinct from a confirmed missing codec', () => {
    // The current /api/clips/export/capabilities endpoint returns [] (no probe).
    expect(mp3EncoderAvailable([])).toBe(true)
    expect(mp3EncoderAvailable(undefined)).toBe(true)
    expect(mp3EncoderAvailable(['libmp3lame'])).toBe(true)
  })

  it('never changes the labels for other requested formats', () => {
    expect(exportActionLabel('m4a', ['aac'])).toBe('Export Audio (M4A)')
    expect(exportDownloadLabel('m4a', ['aac'])).toBe('Download M4A')
    expect(effectiveAudioDeliverFormat('wav', ['pcm_s16le'])).toBe('wav')
    expect(effectiveAudioDeliverFormat('mp4', [])).toBe('mp4')
  })
})

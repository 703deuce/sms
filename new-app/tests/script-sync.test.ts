import { describe, expect, it } from 'vitest'
import { findActiveWordIndex, formatScriptTimecode, videoTimeSecFromSourceMs } from '@/lib/clips/script-editor/sync-playhead'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'

const words: EditorWord[] = [
  { id: 'a:0', index: 0, t0Ms: 0, t1Ms: 500, text: 'Hi', speakerId: 'spk:0' },
  { id: 'a:1', index: 1, t0Ms: 500, t1Ms: 1000, text: 'there', speakerId: 'spk:0' },
  { id: 'a:2', index: 2, t0Ms: 2000, t1Ms: 2500, text: 'Guest', speakerId: 'spk:1' },
]

describe('sync-playhead', () => {
  it('formats timecode with tenths', () => {
    expect(formatScriptTimecode(65300)).toBe('1:05.3')
    expect(formatScriptTimecode(500)).toBe('0:00.5')
  })

  it('finds word under playhead', () => {
    expect(findActiveWordIndex(words, 600)).toBe(1)
    expect(findActiveWordIndex(words, 2100)).toBe(2)
    expect(findActiveWordIndex(words, 1500)).toBe(1)
  })

  it('maps source ms to video time with range offset', () => {
    expect(videoTimeSecFromSourceMs(90_000, 60_000)).toBe(30)
  })
})

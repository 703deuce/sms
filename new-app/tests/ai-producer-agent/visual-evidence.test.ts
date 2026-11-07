import { describe, expect, it } from 'vitest'
import {
  timestampedAsrForVisual, visualMomentsWithAsr, chooseVisualFocusWindows,
} from '@/lib/ai-producer-agent/visual-evidence'
import type { ClipWord } from '@/lib/clips/edits'

const words:ClipWord[]=[
  {w:'Opening',s:10,e:10.5},{w:'the',s:10.5,e:10.7},
  {w:'package',s:10.7,e:11.3},{w:'now.',s:11.3,e:12},
  {w:'This',s:23,e:23.3},{w:'is',s:23.3,e:23.5},{w:'funny.',s:23.5,e:24},
]
describe('visual + audio evidence for Story',()=>{
  it('keeps existing ASR words in the trimmed proxy timebase without a second transcription',()=>{
    const text=timestampedAsrForVisual(words,[10_000,26_000])
    expect(text).toContain('[0.0s–2.0s] Opening the package now.')
    expect(text).toContain('[13.0s–14.0s] This is funny.')
    expect(timestampedAsrForVisual(words,[20_000,26_000])).not.toContain('Opening')
  })
  it('merges source-timestamped Gemini observations with nearby ASR only, without invented frames',()=>{
    const result=visualMomentsWithAsr([
      {start_s:10,end_s:12,what_happened:'Streamer tears package tape',why_it_works:'Physical comedy',category:'action'},
      {start_s:23,end_s:24,what_happened:'Laughs at gift',category:'reaction'},
      {start_s:99,end_s:100,what_happened:'Outside permitted recording'},
      {start_s:12,end_s:15,what_happened:''},
    ],words,[10_000,26_000],'coarse_3s')
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      sourceRangeMs:[10_000,12_000],analysisTier:'coarse_3s',
      observation:'Streamer tears package tape',spokenContext:'Opening the package now.',
    })
    expect(result[1]!.spokenContext).toContain('funny.')
  })
  it('chooses distinct ranked regions without a duration target or automatic timeline changes',()=>{
    const rows=[
      {start_s:22,end_s:25,score:9},
      {start_s:23,end_s:27,score:8},
      {start_s:61,end_s:70,score:7},
      {start_s:91,end_s:95,score:6},
    ]
    const spans=chooseVisualFocusWindows(rows,[0,100_000],3)
    expect(spans).toHaveLength(3)
    expect(spans[0]![0]).toBeGreaterThanOrEqual(0)
    expect(spans[0]![1]).toBeLessThan(spans[1]![0])
    expect(spans[2]![1]).toBeLessThanOrEqual(100_000)
  })
})

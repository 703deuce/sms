import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { YtFinishedWindow } from '@/lib/youtube-video/pipeline/yt-types'

const { structuredDecision } = vi.hoisted(() => ({ structuredDecision: vi.fn() }))

vi.mock('@/lib/youtube-video/pipeline/yt-editorial-handoff', () => ({
  ytStructuredDecision: (...args: unknown[]) => structuredDecision(...args),
}))

import {
  ytChapterTitleLooksGeneric,
  ytFinishWholeSourceStory,
  ytRunStoryFinisher,
} from '@/lib/youtube-video/pipeline/yt-story-finisher'

function finishedWindow(
  sourceIndex:number,startMs:number,endMs:number,evidence:string,beat:string,
):YtFinishedWindow{
  return {
    sourceIndex,startMs,endMs,
    outline:{
      title:sourceIndex===0?'Newsroom merger fallout':'Building an independent show',
      premise:'Grounded premise',opening:'Grounded opening',
      development:'Grounded development',ending:'Grounded ending',exclusions:[],
    },
    cuts:[{
      sourceId:'src_1',startMs:startMs+1000,endMs:startMs+5000,
      beat,label:beat,reason:'Relevant source-grounded passage',kind:'speech',
      groundedEvidence:evidence,
    }],
    rejected:[],coarseCount:1,focusedCount:1,
  }
}

describe('YouTube grounded chapter titles',()=>{
  beforeEach(()=>structuredDecision.mockReset())

  it('repairs generic/missing labels, including a cut added to cover an unselected window',async()=>{
    structuredDecision.mockImplementation(async(name:string)=>{
      if(name==='yt_submit_global_story'){
        return {
          title:'Leaving the newsroom',premise:'A career change after a merger',
          selectedIndices:[0],chapterTitles:['Beat 1: Setup'],
        }
      }
      if(name==='yt_submit_chapter_title_repair'){
        return {titles:['Beat 1: still generic','Part 2']}
      }
      throw new Error('unexpected structured decision '+name)
    })
    const result=await ytFinishWholeSourceStory([
      finishedWindow(0,0,20*60_000,
        'The new owners cut the investigative desk after the merger closed.',
        'Merger closes the investigative desk'),
      finishedWindow(1,20*60_000,40*60_000,
        'I started an independent show and made the first episode about that merger.',
        'Launching the independent show'),
    ])
    expect(result.selectedIndices).toEqual([0,1])
    expect(result.chapterTitles).toHaveLength(2)
    expect(result.chapterTitles.every(title=>!ytChapterTitleLooksGeneric(title))).toBe(true)
    expect(result.chapterTitles[0]?.toLowerCase()).toContain('owners')
    expect(result.chapterTitles[1]?.toLowerCase()).toContain('independent')
  })
})


describe('YT02 scalable selection schemas', () => {
  beforeEach(() => structuredDecision.mockReset())

  it('allows over 36 vetted cuts in one window', async () => {
    const cuts = Array.from({ length: 40 }, (_, i) => ({
      sourceId: 'src_1', startMs: i * 1000, endMs: (i + 1) * 1000,
      beat: `Grounded event ${i}`, reason: 'Observed segment', kind: 'speech' as const,
    }))
    structuredDecision.mockResolvedValue({
      keepIndices: cuts.map((_, i) => i), genuineEnding: false, endingEvidence: '',
    })
    const outline = finishedWindow(0, 0, 1200000, 'Evidence', 'Evidence').outline
    const kept = await ytRunStoryFinisher({
      sourceId: 'src_1', windowIndex: 0, windowCount: 2,
      startMs: 0, endMs: 1200000, words: [], observations: [], instruction: null,
    }, outline, cuts)
    expect(kept).toHaveLength(40)
    expect((structuredDecision.mock.calls[0]?.[3] as {keepIndices:{maxItems:number}}).keepIndices.maxItems).toBe(40)
  })

  it('retains 60 chosen windows with content-grounded chapter titles', async () => {
    const windows = Array.from({ length: 60 }, (_, i) => finishedWindow(
      0, i * 1200000, (i + 1) * 1200000,
      `Independent reporting recorded moment ${i}`,
      `Independent reporting recorded moment ${i}`,
    ))
    structuredDecision.mockResolvedValue({
      title: 'Long source narrative', premise: 'Evidence from every window',
      selectedIndices: windows.map((_, i) => i),
      chapterTitles: windows.map((_, i) => `Independent reporting moment ${i}`),
    })
    const result = await ytFinishWholeSourceStory(windows)
    expect(result.selectedIndices).toHaveLength(60)
    expect(result.chapterTitles).toHaveLength(60)
    expect(result.chapterTitles[59]).toContain('59')
    const schema = structuredDecision.mock.calls[0]?.[3] as {
      selectedIndices: {maxItems:number}; chapterTitles: {maxItems:number}
    }
    expect(schema.selectedIndices.maxItems).toBe(60)
    expect(schema.chapterTitles.maxItems).toBe(60)
  })
})

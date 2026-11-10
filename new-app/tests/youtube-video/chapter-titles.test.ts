import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { YtFinishedWindow } from '@/lib/youtube-video/pipeline/yt-types'

const { structuredDecision } = vi.hoisted(() => ({ structuredDecision: vi.fn() }))

vi.mock('@/lib/youtube-video/pipeline/yt-editorial-handoff', () => ({
  ytStructuredDecision: (...args: unknown[]) => structuredDecision(...args),
}))

import {
  ytChapterTitleLooksGeneric,
  ytFinishWholeSourceStory,
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

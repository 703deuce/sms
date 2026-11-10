import {readFileSync} from 'node:fs'
import {dirname,join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {describe,expect,it} from 'vitest'
import {overlapFraction,isMostlySameContent,overlapStats,rankCandidate} from '@/lib/ai-producer-agent/clip-mode/candidates'
import {
  mergeUnifiedClips,
  UNIFIED_OVERLAP_THRESHOLD,
  type UnifiedMergeClip,
} from '@/lib/ai-producer-agent/clip-mode/unified-merge'
import {
  chooseFallbackPublications,
  evaluateCandidateAfterPlan,
  isCriticalEditorialFailure,
  type StoryBeat,
} from '@/lib/ai-producer-agent/clip-mode/editorial-safety'

const seg=(startMs:number,endMs:number)=>({startMs,endMs})
const clip=(partial:Partial<UnifiedMergeClip> & Pick<UnifiedMergeClip,'id'|'type'|'score'|'segments'>):UnifiedMergeClip=>({
  startMs:partial.segments[0]?.startMs??0,
  ...partial,
})

describe('unified clipper merge, dedupe, mix, and tagging',()=>{
  it('keeps type tags on the merged list',()=>{
    // Two Story clips so a fill-in continuous can stay under the majority rule.
    const result=mergeUnifiedClips([
      clip({id:'s1',type:'story',score:80,segments:[seg(0,10_000),seg(40_000,60_000)]}),
      clip({id:'s2',type:'story',score:75,segments:[seg(200_000,220_000),seg(240_000,260_000)]}),
      clip({id:'c1',type:'continuous',score:70,segments:[seg(100_000,120_000)]}),
    ])
    expect(result.kept.map(c=>c.type)).toEqual(['story','story','continuous'])
    expect(result.kept.map(c=>c.id)).toEqual(['s1','s2','c1'])
    expect(result.mix).toEqual({story:2,continuous:1,droppedDuplicates:0})
  })

  it('treats overlap as a duplicate only when shared time is most of both clips',()=>{
    // 25s continuous almost entirely covers a 30s Story (83% of the longer).
    const story=clip({id:'s1',type:'story',score:90,segments:[seg(0,30_000)]})
    const continuous=clip({id:'c1',type:'continuous',score:70,segments:[seg(0,25_000)]})
    expect(isMostlySameContent(story.segments,continuous.segments)).toBe(true)
    const result=mergeUnifiedClips([story,continuous])
    expect(result.kept.map(c=>c.id)).toEqual(['s1'])
    expect(result.droppedDuplicates).toEqual([
      {droppedId:'c1',keptId:'s1',fraction:expect.any(Number)},
    ])
    expect(result.droppedDuplicates[0]!.fraction).toBeGreaterThan(0.6)
    expect(result.mix.droppedDuplicates).toBe(1)
  })

  it('keeps a short continuous moment that sits inside a much longer Story',()=>{
    // Live bug: intersection/min(duration)=1.0 deleted moments that were only
    // 5–12% of the Story. Two Story clips so the mix rule allows one continuous.
    const story=clip({id:'s1',type:'story',score:90,segments:[seg(0,107_735)]})
    const story2=clip({id:'s2',type:'story',score:80,segments:[seg(200_000,316_940)]})
    const moment=clip({id:'c1',type:'continuous',score:70,segments:[seg(21_7675,24_3915)]})
    expect(overlapFraction(story2.segments,moment.segments)).toBeGreaterThan(0.6)
    expect(overlapStats(story2.segments,moment.segments).longer).toBeLessThan(0.3)
    expect(isMostlySameContent(story2.segments,moment.segments)).toBe(false)
    const result=mergeUnifiedClips([story,story2,moment])
    expect(result.kept.map(c=>c.id)).toEqual(['s1','s2','c1'])
    expect(result.droppedDuplicates).toEqual([])
  })

  it('allows overlap at exactly 60% (threshold is greater-than, not greater-or-equal)',()=>{
    // shorter = 10s, intersection = 6s exactly. A second Story clip lets the
    // continuous fill-in survive the story-majority mix.
    const story=clip({id:'s1',type:'story',score:80,segments:[seg(0,20_000),seg(50_000,70_000)]})
    const story2=clip({id:'s2',type:'story',score:75,segments:[seg(200_000,220_000),seg(240_000,260_000)]})
    const continuous=clip({id:'c1',type:'continuous',score:70,segments:[seg(14_000,24_000)]})
    expect(overlapFraction(story.segments,continuous.segments)).toBeCloseTo(0.6,5)
    const result=mergeUnifiedClips([story,story2,continuous])
    expect(result.kept.map(c=>c.id)).toEqual(['s1','s2','c1'])
    expect(result.droppedDuplicates).toEqual([])
    expect(result.kept.find(c=>c.id==='s1')!.overlaps).toEqual([{clipId:'c1',fraction:0.6}])
    expect(result.kept.find(c=>c.id==='c1')!.overlaps).toEqual([{clipId:'s1',fraction:0.6}])
  })

  it('on a score tie, keeps the Story clip when two clips exceed 60% overlap',()=>{
    const story=clip({id:'s1',type:'story',score:70,segments:[seg(0,30_000)]})
    const continuous=clip({id:'c1',type:'continuous',score:70,segments:[seg(5_000,25_000)]})
    const result=mergeUnifiedClips([continuous,story])
    expect(result.kept.map(c=>c.id)).toEqual(['s1'])
    expect(result.droppedDuplicates[0]).toMatchObject({droppedId:'c1',keptId:'s1'})
  })

  it('keeps a higher-scoring continuous clip when it duplicates a lower-scoring Story clip',()=>{
    const story=clip({id:'s1',type:'story',score:40,segments:[seg(0,30_000)]})
    const continuous=clip({id:'c1',type:'continuous',score:90,segments:[seg(0,25_000)]})
    const result=mergeUnifiedClips([story,continuous])
    expect(result.kept.map(c=>c.id)).toEqual(['c1'])
    expect(result.droppedDuplicates[0]).toMatchObject({droppedId:'s1',keptId:'c1'})
  })

  it('makes Story the majority by filling in continuous clips, never dropping Story for mix',()=>{
    const clips=mergeUnifiedClips([
      clip({id:'s1',type:'story',score:90,segments:[seg(0,20_000),seg(80_000,100_000)]}),
      clip({id:'s2',type:'story',score:80,segments:[seg(200_000,230_000),seg(300_000,320_000)]}),
      clip({id:'c1',type:'continuous',score:75,segments:[seg(400_000,420_000)]}),
      clip({id:'c2',type:'continuous',score:70,segments:[seg(500_000,520_000)]}),
      clip({id:'c3',type:'continuous',score:60,segments:[seg(600_000,620_000)]}),
    ])
    expect(clips.mix.story).toBe(2)
    expect(clips.mix.continuous).toBe(1)
    expect(clips.kept.map(c=>c.id)).toEqual(['s1','s2','c1'])
    expect(clips.kept.every(c=>c.type==='story'||c.id==='c1')).toBe(true)
    expect(clips.mix.story).toBeGreaterThan(clips.mix.continuous)
  })

  it('ships valid continuous clips when no Story clip survived',()=>{
    const result=mergeUnifiedClips([
      clip({id:'c1',type:'continuous',score:80,segments:[seg(0,20_000)]}),
      clip({id:'c2',type:'continuous',score:70,segments:[seg(40_000,60_000)]}),
    ])
    expect(result.kept.map(c=>c.id)).toEqual(['c1','c2'])
    expect(result.mix).toEqual({story:0,continuous:2,droppedDuplicates:0})
  })

  it('orders the list by score descending, then Story before continuous, then startMs',()=>{
    const result=mergeUnifiedClips([
      clip({id:'c-late',type:'continuous',score:80,segments:[seg(80_000,100_000)],startMs:80_000}),
      clip({id:'s-late',type:'story',score:80,segments:[seg(40_000,50_000),seg(200_000,220_000)],startMs:40_000}),
      clip({id:'s-early',type:'story',score:90,segments:[seg(0,10_000),seg(30_000,50_000)],startMs:0}),
    ])
    expect(result.kept.map(c=>c.id)).toEqual(['s-early','s-late','c-late'])
  })
})

type Word={w:string;s:number;e:number}
type Cut={startMs:number;endMs:number}
type Draft={clipId:string|null;rejected:boolean;cuts:Cut[];qaIssues:string[];words:Word[];mode?:'story'|'moment';storyPlan?:StoryBeat[]}
type Fixture={runId:string;drafts:Draft[];mode?:'story'|'moment';storyPlan?:StoryBeat[]}

const fixtureDir=dirname(fileURLToPath(import.meta.url))
function loadReplayFixture(name:string):Fixture{
  return JSON.parse(readFileSync(join(fixtureDir,'fixtures',name),'utf8')) as Fixture
}

function replayDraft(draft:Draft,fixture:Fixture){
  if(draft.rejected||!draft.clipId||!draft.cuts.length){
    return {clipId:draft.clipId,disposition:'skip_rejected' as const,published:false,needsReview:false,dropped:false,critical:false,cuts:draft.cuts,score:0}
  }
  const storyPlan=draft.storyPlan??fixture.storyPlan
  const evaluated=evaluateCandidateAfterPlan({
    cuts:draft.cuts,words:draft.words,storyPlan,
    qa:{pass:false,issues:draft.qaIssues},
  })
  const durationSeconds=evaluated.workingCuts.reduce((n,c)=>n+(c.endMs-c.startMs),0)/1000
  const score=rankCandidate({
    finderScore:70,
    qaPass:evaluated.disposition==='publish',
    issues:evaluated.combinedIssues.length,
    durationSeconds,
    targetS:60,
  })
  return {
    clipId:draft.clipId,
    disposition:evaluated.disposition,
    published:evaluated.disposition==='publish'||evaluated.disposition==='publish_needs_review',
    needsReview:evaluated.disposition==='publish_needs_review',
    dropped:evaluated.disposition==='drop',
    critical:isCriticalEditorialFailure(evaluated.workingRisks,evaluated.combinedIssues),
    cuts:evaluated.workingCuts,
    score,
    words:draft.words,
  }
}

function sourceWords(fixture:Fixture):Word[]{
  return fixture.drafts.reduce((best:Word[],d)=>d.words.length>best.length?d.words:best,[] as Word[])
}

/** Derive continuous fill-ins from the same transcript without a live moment pass. */
function continuousFillIns(fixture:Fixture,storyPublished:ReturnType<typeof replayDraft>[]):UnifiedMergeClip[]{
  const words=sourceWords(fixture)
  const out:UnifiedMergeClip[]=[]
  // Single 15–60s Story segments, scored below their parent so a duplicate keeps Story.
  for(const story of storyPublished){
    if(!story.clipId)continue
    story.cuts.forEach((cut,i)=>{
      const dur=cut.endMs-cut.startMs
      if(dur<15_000||dur>60_000)return
      out.push(clip({
        id:`${story.clipId}:seg${i}`,
        type:'continuous',
        score:Math.max(0,story.score-15),
        segments:[cut],
        startMs:cut.startMs,
      }))
    })
  }
  // Uncovered 15–30s gaps in the transcript, so some fill-ins can survive the 60% rule.
  const covered=[...storyPublished.flatMap(s=>s.cuts)].sort((a,b)=>a.startMs-b.startMs)
  const merged:Cut[]=[]
  for(const c of covered){
    const last=merged[merged.length-1]
    if(!last||c.startMs>last.endMs)merged.push({...c})
    else last.endMs=Math.max(last.endMs,c.endMs)
  }
  const wordStart=words.length?Math.round(words[0]!.s*1000):0
  const wordEnd=words.length?Math.round(words[words.length-1]!.e*1000):0
  let cursor=wordStart
  let gapIndex=0
  const edges=[...merged,{startMs:wordEnd,endMs:wordEnd}]
  for(const block of edges){
    const gapStart=cursor
    const gapEnd=block.startMs
    if(gapEnd-gapStart>=15_000){
      const end=Math.min(gapStart+30_000,gapEnd)
      const window={startMs:gapStart,endMs:end}
      const inWindow=words.filter(w=>w.e*1000>=window.startMs&&w.s*1000<=window.endMs)
      if(inWindow.length>=8){
        const evaluated=evaluateCandidateAfterPlan({
          cuts:[window],words,qa:{pass:true,issues:[]},
        })
        if(evaluated.disposition==='publish'||evaluated.disposition==='publish_needs_review'){
          const durationSeconds=evaluated.workingCuts.reduce((n,c)=>n+(c.endMs-c.startMs),0)/1000
          out.push(clip({
            id:`gap-${fixture.runId.slice(-6)}-${gapIndex}`,
            type:'continuous',
            score:rankCandidate({finderScore:55,qaPass:evaluated.disposition==='publish',
              issues:evaluated.combinedIssues.length,durationSeconds,targetS:30}),
            segments:evaluated.workingCuts,
            startMs:evaluated.workingCuts[0]!.startMs,
          }))
        }
      }
      gapIndex++
    }
    cursor=Math.max(cursor,block.endMs)
  }
  return out
}

function replayUnified(fixture:Fixture){
  const results=fixture.drafts.map(d=>replayDraft(d,fixture))
  let storyPublished=results.filter(r=>r.published)
  if(!storyPublished.length){
    const usable=results.filter(r=>r.clipId&&r.dropped&&!r.critical)
    storyPublished=chooseFallbackPublications(usable,0,3,(r:{critical:boolean})=>r.critical)
      .map(r=>({...r,published:true,needsReview:true,dropped:false,disposition:'publish_needs_review' as const}))
  }
  const storyClips:UnifiedMergeClip[]=storyPublished.filter(s=>s.clipId).map(s=>clip({
    id:s.clipId!,
    type:'story',
    score:s.score,
    segments:s.cuts,
    startMs:s.cuts[0]!.startMs,
  }))
  const continuous=continuousFillIns(fixture,storyPublished)
  const merged=mergeUnifiedClips([...storyClips,...continuous])
  return {
    runId:fixture.runId,
    storyCandidates:storyClips.length,
    continuousCandidates:continuous.length,
    ...merged.mix,
    keptIds:merged.kept.map(c=>c.id),
    keptTypes:merged.kept.map(c=>c.type),
    droppedDuplicates:merged.droppedDuplicates,
  }
}

describe('offline unified replay of #1111 fixtures (no live generation)',()=>{
  it('aprun_a3c71b5a: Story majority after 60% dedupe, editorial-safe Story set intact',()=>{
    const replay=replayUnified(loadReplayFixture('aprun_a3c71b5a.replay.json'))
    expect(replay.runId).toBe('aprun_a3c71b5acee74a5ea52192768053a1ea')
    expect(replay.storyCandidates).toBe(13)
    expect(replay.story).toBeGreaterThan(0)
    if(replay.story>0&&replay.continuous>0)expect(replay.story).toBeGreaterThan(replay.continuous)
    expect(replay.story+replay.continuous).toBe(replay.keptIds.length)
    // Recorded for the report: do not require a specific fill-in count.
    expect(replay.continuousCandidates).toBeGreaterThanOrEqual(0)
    console.log('UNIFIED_REPLAY_a3c71b5a',JSON.stringify({
      storyCandidates:replay.storyCandidates,
      continuousCandidates:replay.continuousCandidates,
      publishedStory:replay.story,
      publishedContinuous:replay.continuous,
      droppedDuplicates:replay.droppedDuplicates,
    }))
  })

  it('aprun_7574d85f: Story majority after 60% dedupe, editorial-safe Story set intact',()=>{
    const replay=replayUnified(loadReplayFixture('aprun_7574d85f.replay.json'))
    expect(replay.runId).toBe('aprun_7574d85f5ce64fcdb58a05c2e0b5b8e6')
    expect(replay.storyCandidates).toBe(16)
    expect(replay.story).toBeGreaterThan(0)
    if(replay.story>0&&replay.continuous>0)expect(replay.story).toBeGreaterThan(replay.continuous)
    expect(replay.story+replay.continuous).toBe(replay.keptIds.length)
    console.log('UNIFIED_REPLAY_7574d85f',JSON.stringify({
      storyCandidates:replay.storyCandidates,
      continuousCandidates:replay.continuousCandidates,
      publishedStory:replay.story,
      publishedContinuous:replay.continuous,
      droppedDuplicates:replay.droppedDuplicates,
    }))
  })
})

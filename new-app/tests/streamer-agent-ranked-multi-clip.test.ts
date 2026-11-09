import {describe,expect,it} from 'vitest'
import {rankAgentClipCandidates,rankedCompletedAgentClips,sameFinishedCut}
  from '@/lib/streamer/agent-clip-ranking'
import {streamerAgentWindows} from '@/lib/streamer/agent-windows'
import {readStreamerAgentBatch} from '@/lib/streamer/agent-batch-contract'

const moment=(start_s:number,end_s:number,score:number,what_happened:string)=>({
  start_s,end_s,score,what_happened,peak_s:(start_s+end_s)/2,
  why_it_works:'Source-grounded video, audio and transcript event',
  category:'reaction',
})
describe('ranked multi-result AI clipper',()=>{
  it('discovers six distinct real events from a three minute upload in BOTH modes',()=>{
    const raw=[
      moment(9,23,.65,'first'),moment(35,48,.95,'second'),
      moment(59,74,.75,'third'),moment(84,100,.9,'fourth'),
      moment(113,131,.7,'fifth'),moment(150,169,.8,'sixth'),
    ]
    for(const target of [30,60,90]){
      const selected=rankAgentClipCandidates(raw,[0,180000],target,7)
      expect(selected).toHaveLength(6)
      expect(selected[0]?.score).toBe(95)
      expect(selected.map(s=>s.id)).toHaveLength(new Set(selected.map(s=>s.id)).size)
      expect(selected.every(s=>s.rangeMs[0]>=0&&s.rangeMs[1]<=180000)).toBe(true)
    }
  })
  it('deduplicates model observations of the same event; never fabricates extra clips',()=>{
    const raw=[moment(50,70,.9,'best'),moment(52,68,.7,'duplicate'),
      moment(130,148,.8,'second')]
    expect(rankAgentClipCandidates(raw,[0,180000],60)).toHaveLength(2)
    expect(rankAgentClipCandidates([], [0,180000],60)).toEqual([])
  })
  it('retains absolute timestamps beyond a 20 minute source window',()=>{
    const range:[number,number]=[1_200_000,2_400_000]
    const picks=rankAgentClipCandidates([
      moment(1260,1280,.88,'late reaction'),moment(2180,2205,.82,'late payoff'),
    ],range,60)
    expect(picks).toHaveLength(2)
    expect(picks.every(p=>p.rangeMs[0]>=range[0]&&p.rangeMs[1]<=range[1])).toBe(true)
  })
  it('ranks only finished edited products, preserving quality scores and metadata',()=>{
    const ranked=rankedCompletedAgentClips([
      {clipId:'a',score:72,startMin:1},
      {clipId:'b',score:97,startMin:0},
      {clipId:'c',score:82,startMin:2},
    ])
    expect(ranked.map(x=>[x.clipId,x.rank])).toEqual([['b',1],['c',2],['a',3]])
  })
  it('suppresses duplicated FINAL cuts, but not different clips with overlapping context',()=>{
    expect(sameFinishedCut([[10000,40000]],[[11000,39000]])).toBe(true)
    expect(sameFinishedCut([[10000,30000],[50000,80000]],[[70000,95000]])).toBe(false)
    expect(sameFinishedCut([],[[10000,40000]])).toBe(false)
  })
  it('ranks QA-passing edits ahead of higher-scoring but QA-failing edits',()=>{
    const ranked=rankedCompletedAgentClips([
      {clipId:'highScout',score:95,startMin:0,qaPass:false},
      {clipId:'approved',score:88,startMin:1,qaPass:true},
    ])
    expect(ranked.map(x=>x.clipId)).toEqual(['approved','highScout'])
  })
  it('preserves durable batch progress and ranked clip results after reload',()=>{
    const batch={id:'sagent_one',status:'running',mode:'clip_story_v1',
      seconds:60,index:0,total:1,sourceStartMs:0,sourceDurationMs:180000,
      candidateIndex:2,discoveredCount:6,
      candidates:rankAgentClipCandidates([moment(10,25,.8,'scene')],[0,180000],60),
      completed:[{clipId:'clip1',projectId:'proj1',startMin:0,score:80,rank:1}],
      errors:[],startedAt:'2026-11-09T02:00:00Z'}
    expect(readStreamerAgentBatch({agentClipBatch:JSON.parse(JSON.stringify(batch))})?.discoveredCount).toBe(6)
    expect(readStreamerAgentBatch({agentClipBatch:batch})?.completed[0]?.score).toBe(80)
    expect(streamerAgentWindows(0,180000,true)).toEqual([[0,180000]])
  })
})

import {describe,expect,it} from 'vitest'
import {instructionAsksToCompile,mergeTopicCandidates,topicPassagesFromTranscript,topicQueryFromInstruction,whyThisClip} from '@/lib/ai-producer-agent/clip-mode/topic-search'
import {processCreditsForClipRun,shouldChargeClipRun} from '@/lib/clips/credit-policy'
import {clipCandidateLimit} from '@/lib/ai-producer-agent/clip-mode/candidates'

const words=(text:string,startMs=0,spacingMs=300)=>
  text.split(' ').map((w,i)=>({w,s:(startMs+i*spacingMs)/1000,e:(startMs+i*spacingMs+240)/1000}))

describe('topic and prompt compilation',()=>{
  it('ignores a generic narrative instruction and keeps a specific topic request',()=>{
    expect(topicQueryFromInstruction('Create one coherent narrative from distinct original source beats.')).toBe('')
    expect(topicQueryFromInstruction('Find every time they talk about constitutional rights')).toContain('constitutional')
    expect(instructionAsksToCompile('Make one clip of every time they talk about rights')).toBe(true)
  })
  it('finds transcript passages matching the requested topic',()=>{
    const w=[
      ...words('Today we will discuss traffic and weather reports',0),
      ...words('I believe in constitutional rights and the right to pray',40000),
    ]
    const hits=topicPassagesFromTranscript(w,'constitutional rights',[0,80000])
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0]!.startMs).toBeGreaterThan(30000)
  })
  it('merges topic hits into the candidate list without duplicating nearby peaks',()=>{
    const merged=mergeTopicCandidates(
      [{index:0,startMs:0,endMs:40000,peakMs:20000,finderScore:80,label:'A'}],
      [{startMs:100000,endMs:112000}],
      [0,200000],
      60,
    )
    expect(merged.length).toBe(2)
    expect(whyThisClip({logline:'Why rights matter',durationSeconds:58,targetS:60,distinctMoments:2}))
      .toMatch(/self-contained story/i)
  })
})

describe('credit policy does not burn credits on failed clips',()=>{
  it('charges nothing when a run fails, is canceled, or publishes no clips',()=>{
    expect(processCreditsForClipRun({status:'failed',publishedClipCount:0,sourceDurationMs:3_931_162})).toBe(0)
    expect(processCreditsForClipRun({status:'canceled',publishedClipCount:0})).toBe(0)
    expect(processCreditsForClipRun({status:'ready',publishedClipCount:0})).toBe(0)
    expect(shouldChargeClipRun({status:'failed',publishedClipCount:3})).toBe(false)
  })
  it('charges per kept clip only after a successful publish',()=>{
    expect(processCreditsForClipRun({status:'ready',publishedClipCount:3})).toBe(3)
    expect(shouldChargeClipRun({status:'ready',publishedClipCount:3})).toBe(true)
  })
})

describe('yield scales with source length without unbounded fanout',()=>{
  it('asks for more candidates on a long interview than a short window',()=>{
    expect(clipCandidateLimit(1_200_000)).toBe(12)
    expect(clipCandidateLimit(3_931_162)).toBeGreaterThan(12)
    expect(clipCandidateLimit(10*60*60_000)).toBeLessThanOrEqual(18)
  })
})

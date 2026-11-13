import { describe,expect,it } from 'vitest'
import { ytResolveVisualScenes } from '../lib/youtube-video/pipeline/yt-gaming-scene-cuts'
import type { YtWindowContext,YtObservation,YtSelectedCut } from '../lib/youtube-video/pipeline/yt-types'

const observe=(startMs:number,endMs:number,key:string,phase:string):YtObservation=>({
  startMs,endMs,description:`SCENE_KEY=${key}; ACTION_PHASE=${phase}; GTA police chase of same car`,
  whyInteresting:'Keeps on-screen cause and resolution',category:'gaming',score:80,tier:'coarse',
})
const ctx=(observations:YtObservation[]):YtWindowContext=>({
  sourceId:'gta',startMs:0,endMs:240_000,words:[],instruction:null,observations,
})
const cut=(startMs:number,endMs:number,kind:'speech'|'visual',beat='Chase'):YtSelectedCut=>({
  sourceId:'gta',startMs,endMs,kind,beat,reason:'source observed',
})

describe('YouTube-only gaming scene coverage',()=>{
  it('expands a 13-second dialogue proposal to its observed 155-second chase',()=>{
    const evidence=[
      observe(0,50_000,'police_chase','start'),
      observe(50_000,105_000,'police_chase','middle'),
      observe(105_000,155_000,'police_chase','resolved'),
    ]
    const result=ytResolveVisualScenes(ctx(evidence),[
      cut(45_000,58_000,'speech','I am being chased'),
      cut(0,155_000,'visual'),
    ])
    expect(result.cuts).toHaveLength(1)
    expect(result.cuts[0]).toMatchObject({kind:'visual',startMs:0,endMs:155_000})
  })
  it('rejoins a 30-second omitted interval inside the same active car chase',()=>{
    const evidence=[
      observe(0,50_000,'police_chase','start'),
      observe(50_000,100_000,'police_chase','middle'),
      observe(100_000,155_000,'police_chase','resolved'),
    ]
    const result=ytResolveVisualScenes(ctx(evidence),[
      cut(0,60_000,'visual'),cut(90_000,155_000,'visual'),
    ])
    expect(result.cuts).toHaveLength(1)
    expect(result.cuts[0]).toMatchObject({startMs:0,endMs:155_000})
  })
  it('does not splice unrelated carjackings even when their times overlap',()=>{
    const evidence=[
      observe(0,60_000,'vehicle_a_carjack','resolved'),
      observe(60_000,130_000,'vehicle_b_carjack','start'),
    ]
    const result=ytResolveVisualScenes(ctx(evidence),[
      cut(0,60_000,'visual'),cut(65_000,130_000,'visual'),
    ])
    expect(result.cuts).toHaveLength(2)
  })
  it('never outputs an unsupported speech-only cut',()=>{
    const result=ytResolveVisualScenes(ctx([]),[cut(10_000,22_000,'speech')])
    expect(result.cuts).toEqual([])
    expect(result.rejected[0]?.code).toBe('yt_speech_missing_visual_scene')
  })
})

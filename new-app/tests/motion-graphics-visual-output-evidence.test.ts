import {describe,expect,it} from 'vitest'
import {visualObservationsInOutput} from '@/lib/clips/motion-graphics/visual-output-evidence'
import type {VisualMomentEvidence} from '@/lib/ai-producer-agent/visual-evidence'

const visual=(start:number,end:number,observation:string):VisualMomentEvidence=>({
  sourceRangeMs:[start,end],observation,whyInteresting:'',
  category:'moment',spokenContext:'',analysisTier:'coarse_1fps',
})

describe('automatic graphics only use visual evidence present in final cuts',()=>{
  const cut={segs:[[1000,5000],[9000,13000]] as [number,number][],
    starts:[0,4000],durationMs:8000}
  it('projects original observations into the locked output timeline',()=>{
    expect(visualObservationsInOutput([
      visual(2500,3500,'speaker points at screen'),
      visual(9500,10300,'visible diagram'),
    ],cut)).toEqual([
      {startMs:1500,endMs:2500,observation:'speaker points at screen'},
      {startMs:4500,endMs:5300,observation:'visible diagram'},
    ])
  })
  it('never uses removed footage as visual evidence',()=>{
    expect(visualObservationsInOutput([visual(6000,8000,'removed scene')],cut)).toEqual([])
  })
  it('splits observations crossing jump cuts rather than invent continuity',()=>{
    expect(visualObservationsInOutput([visual(4000,10000,'sustained action')],cut))
      .toEqual([
        {startMs:3000,endMs:4000,observation:'sustained action'},
        {startMs:4000,endMs:5000,observation:'sustained action'},
      ])
  })
  it('retains edit order when the approved story rearranges scenes',()=>{
    const reordered={segs:[[9000,13000],[1000,5000]] as [number,number][],
      starts:[0,4000],durationMs:8000}
    expect(visualObservationsInOutput([visual(2500,3500,'early scene'),
      visual(9500,10300,'late scene')],reordered).map(x=>x.observation))
      .toEqual(['late scene','early scene'])
  })
})

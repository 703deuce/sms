import { describe, expect, it } from 'vitest'
import { approvedRoughCutSegmentArgs } from '@/lib/ai-producer-agent/assembly-segment-args'

describe('AI Producer approval to execution contract',()=>{
  it('keeps the real source timestamps and never sends narrative beat prose as a schema enum',()=>{
    const dialogue=approvedRoughCutSegmentArgs('recording',{
      startMs:340320,endMs:352855,
      beat:'First package: the impossible tape',
      reason:'Keep his frustration and the package reveal',
    })
    expect(dialogue).toEqual({sourceId:'recording',srcInMs:340320,srcOutMs:352855})
    expect(dialogue).not.toHaveProperty('beat')

    const action=approvedRoughCutSegmentArgs('recording',{
      kind:'visual_action',visualBeatId:'visual_4',
      startMs:352900,endMs:357879,
      beat:'Taped-package frustration',reason:'Physical comedy',
    })
    expect(action).toEqual({sourceId:'recording',srcInMs:352900,srcOutMs:357879})
    expect(action).not.toHaveProperty('beat')
  })
})

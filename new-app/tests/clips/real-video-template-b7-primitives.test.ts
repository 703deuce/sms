import { describe, expect, it } from 'vitest'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { TextItem } from '@/lib/clips/editor/text-items'
import { applyStandaloneTemplatePrimitives, B7_CAPABILITIES, type TemplatePrimitive } from '@/lib/clips/real-video-templates/b7-primitives'
const blank = {} as ClipEditsV2
const base = (id: string, kind: TemplatePrimitive['kind']): TemplatePrimitive => ({
  id, kind, startMs: 0, endMs: 1800, box: { x: .1, y: .12, width: .8, height: .7 },
  color: '#FFFFFF', accent: '#FFAA33', font: 'Montserrat',
})
function ready(result: ReturnType<typeof applyStandaloneTemplatePrimitives>) {
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.code)
  return result
}
describe('Batch 7 standalone primitives', () => {
  it.each(['9:16','1:1','16:9'] as const)('fits calendar text in %s', format => {
    const r = ready(applyStandaloneTemplatePrimitives(blank,[{...base('date','calendar'),text:'November 11'}],format,1800))
    expect(r.edits.textItems).toHaveLength(3)
    expect(r.edits.textItems?.find(x=>x.id==='b7_date__date')?.text).toContain('November')
  })
  it('keeps independent shapes/labels and original source edits', () => {
    const edits = {...blank,sources:[{id:'original',assetId:'source'}]} as unknown as ClipEditsV2
    const r=ready(applyStandaloneTemplatePrimitives(edits,[
      {...base('a','before_after'),labels:['Before','After']},
      {...base('b','roster'),labels:['One','Two','Three']},
    ],'16:9',1800))
    expect(r.edits.sources).toBe(edits.sources)
    expect(r.edits.textItems?.some(x=>x.text==='Before')).toBe(true)
    expect(r.edits.textItems?.some(x=>x.text==='Three')).toBe(true)
    expect(r.edits.textItems?.some(x=>x.kind==='shape')).toBe(true)
  })
  it('preserves manually authored layers and keyframes and refuses collisions', () => {
    const manual: TextItem={id:'b7_x__title',text:'Manual',startMs:0,endMs:1800,x:50,y:50,
      style:{font:'Montserrat',size:90,color:'#FFFFFF',align:'center',case:'none'}}
    const prev={...blank,textItems:[manual],keyframes:[]} as ClipEditsV2
    const p={...base('x','underline'),text:'Title'}
    expect(applyStandaloneTemplatePrimitives(prev,[p],'9:16',1800))
      .toMatchObject({ok:false,code:'id_collision'})
    const r=ready(applyStandaloneTemplatePrimitives(prev,[{...p,id:'fresh'}],'9:16',1800))
    expect(r.edits.textItems?.[0]).toBe(manual)
    expect(r.edits.keyframes?.length).toBeGreaterThan(0)
  })
  it('refuses overflowing the shared 60-item cap without dropping manual layers', () => {
    const prev={...blank,textItems:Array.from({length:50},(_,i)=>({
      id:'manual_'+i,text:'Manual',startMs:0,endMs:1800,x:50,y:50,
      style:{font:'Montserrat' as const,size:40,color:'#FFFFFF',align:'center' as const,case:'none' as const},
    }))} as ClipEditsV2
    expect(applyStandaloneTemplatePrimitives(prev,[base('particles','confetti')],'1:1',1800))
      .toMatchObject({ok:false,code:'text_capacity'})
    expect(prev.textItems).toHaveLength(50)
  })
  it('static reduced motion retains visible layers', () => {
    const r=ready(applyStandaloneTemplatePrimitives(blank,[{
      ...base('line','line_reveal'),text:'Reveal',reducedMotion:true,
    }],'9:16',1800))
    expect(r.edits.keyframes ?? []).toHaveLength(0)
    expect(r.edits.textItems).toHaveLength(2)
  })
  it('never calls a static numeral a numeric count-up', () => {
    expect(applyStandaloneTemplatePrimitives(blank,[{
      ...base('counter','countdown'),text:'1,000',
    }],'9:16',1800)).toMatchObject({ok:false,code:'unsupported_design'})
    expect(B7_CAPABILITIES.numericCountUp).toContain('unsupported')
  })
  it('rejects duplicate IDs and out-of-bounds graphics', () => {
    const p=base('dup','route_arrow')
    expect(applyStandaloneTemplatePrimitives(blank,[p,p],'16:9',1800))
      .toMatchObject({ok:false,code:'duplicate_id'})
    expect(applyStandaloneTemplatePrimitives(blank,[{
      ...p,box:{x:.8,y:.8,width:.4,height:.4},
    }],'16:9',1800)).toMatchObject({ok:false,code:'invalid_box'})
  })
})

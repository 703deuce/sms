import {describe,it,expect} from 'vitest'
import {defaultEdits} from '@/lib/clips/edits'
import {applyProducerTool,applyProducerTools} from '@/lib/clips/edits-reducer'
import {editorRailGroups,INVENTORY_RAIL_LABEL_TO_PANEL} from '@/lib/clips/editor/editor-rail-navigation'

const bounds={clipStartMs:0,clipEndMs:60000}
describe('real AI Producer text changes',()=>{
 it('inserts a title card at 0:00 and lower-third at 0:30',()=>{
  const base=defaultEdits(bounds)
  const applied=applyProducerTools(base,bounds,[
   {name:'add_text_overlay',args:{kind:'title_card',text:'The Best Moment',atMs:0,durationMs:3000}},
   {name:'add_text_overlay',args:{kind:'lower_third',text:'Behind the Scenes',atMs:30000,durationMs:4000}},
  ])
  expect(applied.edits.textItems).toHaveLength(2)
  expect(applied.edits.textItems?.[0]).toMatchObject({text:'The Best Moment',startMs:0,endMs:3000})
  expect(applied.edits.textItems?.[1]).toMatchObject({text:'Behind the Scenes',startMs:30000,endMs:34000})
  expect(JSON.stringify(applied.edits)).not.toBe(JSON.stringify(base))
 })
 it('legacy no-op set_title never claims to add a visible text layer',()=>{
  const base=defaultEdits(bounds)
  const result=applyProducerTool(base,bounds,{name:'set_title',args:{title:'Invisible'}})
  expect(result.edits.textItems).toEqual(base.textItems)
  expect(result.summary).toMatch(/No title change made/)
 })
 it('rejects invalid overlay timing rather than claiming success',()=>{
  const base=defaultEdits(bounds)
  const result=applyProducerTool(base,bounds,{name:'add_text_overlay',
    args:{kind:'lower_third',text:'Test',atMs:-300,durationMs:4000}})
  expect(result.edits.textItems).toEqual(base.textItems)
  expect(result.summary).toMatch(/No text overlay added/)
 })
 it('never claims to add a lower-third beyond the end of a shorter clip',()=>{
  const shortBounds={clipStartMs:0,clipEndMs:26000}
  const base=defaultEdits(shortBounds)
  const result=applyProducerTool(base,shortBounds,{name:'add_text_overlay',
    args:{kind:'lower_third',text:'Too late',atMs:30000,durationMs:3000}})
  expect(result.edits.textItems).toEqual(base.textItems)
  expect(result.summary).toMatch(/outside the finished clip/)
 })
 it('exposes Motion Graphics as its own visible editor tool',()=>{
  const groups=editorRailGroups(false)
  expect(groups.find(x=>x.id==='motion')?.label).toBe('Motion Graphics')
  expect(groups.find(x=>x.id==='motion')?.tabs).toEqual([{id:'motion',tabLabel:'AI Motion Graphics'}])
  expect(INVENTORY_RAIL_LABEL_TO_PANEL['Motion Graphics']).toBe('motion')
 })
})

import {describe,expect,it} from 'vitest'
import {defaultEdits} from '@/lib/clips/edits'
import {applyAgentEditorOperation,AGENT_EDITOR_TOOLS} from '@/lib/motion-studio/editor-agent-operations'

const bounds={clipStartMs:0,clipEndMs:10000}
const base=()=>{
  const edits=defaultEdits(bounds)
  edits.textItems=[{id:'title_1',text:'Old title',startMs:0,endMs:3000,
    x:50,y:30,style:{font:'Montserrat',size:90,color:'#FFFFFF',align:'center',case:'none'}}]
  edits.audio={music:{generationId:'upload_music',uploadId:'upload_music',volume:0.6},sfx:[]}
  return edits
}
const edit=(tool:Parameters<typeof applyAgentEditorOperation>[0]['tool'],parameters:unknown)=>
  applyAgentEditorOperation({tool,parameters,bounds,edits:base()})

describe('Grokbot shares existing ClipEditsV2 editor operations',()=>{
  it('supports editing text and position without erasing the rest of the timeline',()=>{
    const a=edit('set_text',{id:'title_1',text:'Updated title'})
    expect(a.textItems?.[0]?.text).toBe('Updated title')
    expect(a.audio?.music?.uploadId).toBe('upload_music')
    const moved=edit('move_text',{id:'title_1',x:20,y:70})
    expect(moved.textItems?.[0]).toMatchObject({x:20,y:70})
  })
  it('splits the existing full video rather than replacing source media',()=>{
    const a=edit('split_video',{sourceMs:5000})
    expect(a.videoSplits).toContain(5000)
    expect(a.sourceSegments??[]).toEqual([])
  })
  it('controls music volume without changing its original asset',()=>{
    const a=edit('set_music_volume',{volume:0.2})
    expect(a.audio?.music).toMatchObject({uploadId:'upload_music',volume:0.2})
  })
  it('can create text and rejects out-of-bounds or unsupported operations',()=>{
    const added=edit('add_text',{text:'Added text',startMs:3200,endMs:6000})
    expect(added.textItems).toHaveLength(2)
    expect(()=>edit('move_text',{id:'title_1',x:500})).toThrow(/bounds/)
    expect(()=>edit('set_video_effect',{effect:'arbitraryRCE',amount:30})).toThrow(/unsupported/)
  })
  it('exposes real discoverable commands rather than a raw JSON mutation tool',()=>{
    expect(AGENT_EDITOR_TOOLS.some(t=>t.name==='set_text')).toBe(true)
    expect(AGENT_EDITOR_TOOLS.some(t=>t.name==='inspect_timeline')).toBe(true)
    expect(AGENT_EDITOR_TOOLS.some(t=>t.name==='apply_arbitrary_code')).toBe(false)
  })
})

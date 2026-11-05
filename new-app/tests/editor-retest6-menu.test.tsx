// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { Timeline } from '@/components/clips/editor/timeline'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'

const bounds = {clipStartMs:0,clipEndMs:31000,trimMinMs:0,trimMaxMs:31000}
const words = Array.from({length:20},(_,i)=>({i,w:`word${i}`,s:i,e:i+0.6}))
const e:ClipEditsV2 = {
  ...normalizeEdits(defaultEdits(bounds),bounds),
  loopFriendlyEnd:false,
  broll:[{id:'b1',source:'stock',assetId:'stock123',startMs:2000,endMs:5000}],
}
afterEach(()=>cleanup())
function timeline(command: {cmd:{kind:'palette';id:string;selectionHint?:{lane:'broll';id:'b1'}|{lane:'video';atMs:number}};seq:number},onCommitEdits:ReturnType<typeof vi.fn>){
  return <Timeline edits={e} words={words} shots={[]} outputMs={10000} clipOutputDurationMs={31000}
    onSeekOutput={vi.fn()} clipStartMs={0} clipEndMs={31000}
    trimMinMs={0} trimMaxMs={31000} onCommitEdits={onCommitEdits}
    menuCommand={command}/>
}
describe('Retest #6 F2 Edit top menu clipboard commands',()=>{
  it('Duplicate honors a clip selected in the inspector even if Timeline selection is lost during view switch',async()=>{
    const commit=vi.fn()
    render(timeline({cmd:{kind:'palette',id:'duplicate',selectionHint:{lane:'broll',id:'b1'}},seq:1},commit))
    await waitFor(()=>expect(commit).toHaveBeenCalled())
    const edited=commit.mock.calls.at(-1)![0] as ClipEditsV2
    expect(edited.broll?.length).toBe(2)
    expect(edited.broll?.[1]?.id).not.toBe('b1')
  })
  it('Edit Duplicate on the main Video clip creates repeated footage in the EDL',async()=>{
    const commit=vi.fn()
    render(timeline({cmd:{kind:'palette',id:'duplicate',selectionHint:{lane:'video',atMs:10000}},seq:1},commit))
    await waitFor(()=>expect(commit).toHaveBeenCalled())
    const next=commit.mock.calls.at(-1)![0] as ClipEditsV2
    expect(next.sectionOrder?.length).toBeGreaterThan(1)
    expect(next.sectionOrder).not.toEqual(e.sectionOrder)
  })
  it('Copy from inspector then Paste at playhead creates a new timeline item',async()=>{
    const commit=vi.fn()
    const ui=render(timeline({cmd:{kind:'palette',id:'copy',selectionHint:{lane:'broll',id:'b1'}},seq:1},commit))
    await act(async()=>{})
    ui.rerender(timeline({cmd:{kind:'palette',id:'paste'},seq:2},commit))
    await waitFor(()=>expect(commit).toHaveBeenCalled())
    const edited=commit.mock.calls.at(-1)![0] as ClipEditsV2
    expect(edited.broll?.length).toBe(2)
    expect(edited.broll?.[1]?.startMs).toBeGreaterThanOrEqual(9000)
  })
})

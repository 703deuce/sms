// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react'
import { PlayerControls } from '@/components/clips/editor/player-controls'
import { PropertiesPanel } from '@/components/clips/editor/properties-panel'
import { useEditorState } from '@/components/clips/editor/use-editor-state'
import { loopSeekAtOutput } from '@/lib/clips/editor/loop-playback'
import { applyTimelineLaneState, voiceMuted } from '@/lib/clips/editor/clip-timeline'
import { previewSourceMuted } from '@/components/clips/editor/use-audio-mix'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'

vi.mock('@/lib/clips-api', () => ({ patchClip: vi.fn(() => Promise.resolve({})), clipsFetch: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() } }))

const bounds = {clipStartMs:0,clipEndMs:31000,trimMinMs:0,trimMaxMs:31000}
const base = () => normalizeEdits(defaultEdits(bounds),bounds)
afterEach(() => { cleanup(); sessionStorage.clear(); localStorage.clear() })

describe('Editor retest #6 regression controls', () => {
  it('F5 player volume thumb uses an actual movable range control', () => {
    const changed = vi.fn()
    const ui = render(<PlayerControls playing={false} outputMs={1000} outputDurationMs={31000}
      onToggle={vi.fn()} onScrub={vi.fn()} volume={100} onVolumeChange={changed} />)
    const slider = ui.getByTestId('player-volume-slider') as HTMLInputElement
    expect(slider.type).toBe('range')
    expect(slider.value).toBe('100')
    act(() => fireEvent.change(slider,{target:{value:'42'}}))
    expect(changed).toHaveBeenCalledWith(42)
    ui.rerender(<PlayerControls playing={false} outputMs={1000} outputDurationMs={31000}
      onToggle={vi.fn()} onScrub={vi.fn()} volume={42} onVolumeChange={changed} />)
    expect((ui.getByTestId('player-volume-slider') as HTMLInputElement).value).toBe('42')
  })

  it('F9 text Color stays in Properties and offers the selected text color', () => {
    const onOpenTextPanel = vi.fn()
    const onCommit = vi.fn()
    const edits = { ...base(), textItems: [{
      id: 't1', text: 'Hello', startMs: 0, endMs: 3000, x: 50, y: 50,
      style: {font:'Montserrat' as const,size:60,color:'ffffff',align:'center' as const,case:'none' as const}
    }] }
    const ui = render(<PropertiesPanel edits={edits} target="text:t1" label="Text"
      outputMs={1000} onCommit={onCommit} onSeekOutput={vi.fn()} cropMode={false}
      onCropModeChange={vi.fn()} onOpenTextPanel={onOpenTextPanel} />)
    const tab = ui.getByTestId('properties-tab-color') as HTMLButtonElement
    expect(tab.disabled).toBe(false)
    act(() => fireEvent.click(tab))
    expect(onOpenTextPanel).not.toHaveBeenCalled()
    expect(ui.getByTestId('properties-text-color-controls')).toBeTruthy()
    act(() => fireEvent.change(ui.getByLabelText('Text colour'), {target:{value:'#ff0000'}}))
    expect(onCommit).toHaveBeenCalled()
  })

  it('F4 wraps overrun output ticks even after a long or delayed frame', () => {
    expect(loopSeekAtOutput(12000,6240,10340,true,true)).toBe(6240)
    expect(loopSeekAtOutput(18000,6240,10340,true,true)).toBe(6240)
    expect(loopSeekAtOutput(9800,6240,10340,true,true)).toBeNull()
    expect(loopSeekAtOutput(18000,6240,10340,false,true)).toBeNull()
    expect(loopSeekAtOutput(18000,6240,10340,true,false)).toBeNull()
  })

  it('F1 simultaneous Voice and Music mute stays effective', () => {
    const edits = base()
    edits.timelineLanes = {voice:{muted:true},music:{muted:true}}
    edits.audio = {music:{generationId:'song'},sfx:[]}
    expect(voiceMuted(edits)).toBe(true)
    expect(applyTimelineLaneState(edits).audio?.music).toBeNull()
    expect(previewSourceMuted(voiceMuted(edits),false,false,false)).toBe(true)
  })

  it('F6 undo survives a hard editor unmount/remount when the split was saved', () => {
    const id = 'clip_retest6_history'
    const first = renderHook(() => useEditorState(id,bounds,base()))
    const edited = { ...first.result.current.edits, videoSplits:[8000] }
    act(() => first.result.current.setEditsPass(edited,'Split Video clip'))
    expect(first.result.current.canUndo).toBe(true)
    expect(sessionStorage.getItem(`transovo:editor-history:v1:${id}`)).toContain('Split Video clip')
    first.unmount()

    const restored = renderHook(() => useEditorState(id,bounds,edited))
    expect(restored.result.current.canUndo).toBe(true)
    expect(restored.result.current.historyPastLabels.at(-1)).toBe('Split Video clip')
    act(() => restored.result.current.undo())
    expect(restored.result.current.edits.videoSplits ?? []).toHaveLength(0)
    expect(restored.result.current.canRedo).toBe(true)
  })
})

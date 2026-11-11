// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { TextPanel } from '@/components/clips/editor/text-panel'
import { defaultEdits } from '@/lib/clips/edits'

afterEach(cleanup)

describe('TextPanel multi-part templates', () => {
  it('HG09 gives selected text a direct jump to the existing Font/Bold/Italic controls', () => {
    const edits = defaultEdits({ clipStartMs: 0, clipEndMs: 60000 })
    edits.textItems = [{
      id: 'fixture_text', text: 'Welcome', startMs: 0, endMs: 5000,
      x: 50, y: 50, w: 80, h: 20, style: {
        font: 'Montserrat', size: 60, color: '#ffffff', align: 'center',
      },
    }] as typeof edits.textItems
    const ui = render(<TextPanel edits={edits} onEdits={vi.fn()} playheadMs={3000}
      durationMs={60000} selectedId="fixture_text" onSelect={vi.fn()} />)
    const jump = ui.getByTestId('text-jump-to-styles')
    const inspector = ui.getByTestId('text-inspector')
    expect(inspector.id).toBe('text-selected-style-controls')
    expect(ui.getByTestId('text-bold')).toBeTruthy()
    expect(ui.getByTestId('text-italic')).toBeTruthy()
    expect(ui.getByTestId('text-font')).toBeTruthy()
    const scroll = vi.fn()
    inspector.scrollIntoView = scroll
    fireEvent.click(jump)
    expect(scroll).toHaveBeenCalledWith({ block: 'nearest' })
  })

  it('D3: adding a text item and typing is two history steps regardless of typing pauses', () => {
    const commits: boolean[] = []
    const original = defaultEdits({ clipStartMs: 0, clipEndMs: 60000 })
    function Editor() {
      const [edits, setEdits] = useState(original)
      const [selectedId, setSelectedId] = useState<string | null>(null)
      return <TextPanel edits={edits} onEdits={(next, pushHistory) => {
        commits.push(pushHistory !== false)
        setEdits(next)
      }} playheadMs={3000} durationMs={60000} selectedId={selectedId} onSelect={setSelectedId} />
    }
    const ui = render(<Editor />)
    fireEvent.click(ui.getByTestId('text-add'))
    expect(commits).toEqual([true])
    const field = ui.getByTestId('text-content')
    fireEvent.change(field, { target: { value: 'Welcome' } })
    fireEvent.change(field, { target: { value: 'Welcome back' } })
    fireEvent.change(field, { target: { value: 'Welcome back!' } })
    expect(commits).toEqual([true, true, false, false])
    fireEvent.blur(field)
    fireEvent.change(field, { target: { value: 'Welcome back!!' } })
    expect(commits).toEqual([true, true, false, false, true])
  })


  it('Retest4 N14: Quote commits one atomic named undo entry and renders at the click playhead', () => {
    const onEdits = vi.fn()
    const onEditsPass = vi.fn()
    const ui = render(<TextPanel edits={defaultEdits({ clipStartMs: 0, clipEndMs: 60000 })}
      onEdits={onEdits} onEditsPass={onEditsPass}
      playheadMs={7000} durationMs={60000} selectedId={null} onSelect={vi.fn()} />)
    fireEvent.click(ui.getByTestId('text-template-c_qs_quote'))
    expect(onEditsPass).toHaveBeenCalledTimes(1)
    expect(onEdits).not.toHaveBeenCalled()
    expect(onEditsPass.mock.calls[0]![1]).toBe('Added Quote template')
    const next = onEditsPass.mock.calls[0]![0]
    const quote = next.textItems.find((i: { text: string }) => i.text.includes('Your quote goes here'))
    expect(quote.startMs).toBe(7000)
    expect(quote.anim?.in).toBeUndefined()
    expect(next.textItems).toHaveLength(3)
  })

  for (const [id, count] of [['c_qs_quote', 3], ['c_cd_321', 3], ['c_qs_stat', 2]] as const) {
    it(`adds ${id} to the actual Text track at the playhead`, () => {
      const onEdits = vi.fn()
      const onSelect = vi.fn()
      const ui = render(
        <TextPanel edits={defaultEdits({ clipStartMs: 0, clipEndMs: 60000 })} onEdits={onEdits}
          playheadMs={3000} durationMs={60000} selectedId={null} onSelect={onSelect} />,
      )
      fireEvent.click(ui.getByTestId(`text-template-${id}`))
      expect(onEdits).toHaveBeenCalledTimes(1)
      const next = onEdits.mock.calls[0]![0]!
      expect(next.textItems).toHaveLength(count)
      expect(new Set(next.textItems.map((t: { id: string }) => t.id)).size).toBe(count)
      expect(next.textItems.every((t: { startMs: number }) => t.startMs >= 3000)).toBe(true)
      expect(onSelect).toHaveBeenCalledOnce()
    })
  }
  it('E9: countdown parts start at exactly the playhead and remain sequential for a full second', () => {
    const onEdits = vi.fn()
    const ui = render(<TextPanel edits={defaultEdits({ clipStartMs: 0, clipEndMs: 60_000 })}
      onEdits={onEdits} playheadMs={3000} durationMs={60000} selectedId={null} onSelect={vi.fn()} />)
    fireEvent.click(ui.getByTestId('text-template-c_cd_321'))
    const parts = onEdits.mock.calls[0]![0].textItems
    expect(parts.map((t: { startMs: number }) => t.startMs)).toEqual([3000, 4000, 5000])
    expect(parts.map((t: { endMs: number }) => t.endMs)).toEqual([4000, 5000, 6000])
    expect(parts.every((t: { style: { size: number } }) => t.style.size >= 200)).toBe(true)
  })

  it('E9: Quote, Big stat and Countdown show their first visible part exactly at the playhead', () => {
    const initial = defaultEdits({ clipStartMs: 0, clipEndMs: 60_000 })
    const commits: typeof initial[] = []
    function Editor() {
      const [edits, setEdits] = useState(initial)
      return <TextPanel edits={edits} playheadMs={4000} durationMs={60_000}
        selectedId={null} onSelect={vi.fn()} onEdits={(next) => { commits.push(next); setEdits(next) }} />
    }
    const ui = render(<Editor />)
    for (const id of ['c_qs_quote', 'c_cd_321', 'c_qs_stat']) {
      const beforeIds = new Set(commits.at(-1)?.textItems?.map(t => t.id) ?? [])
      fireEvent.click(ui.getByTestId(`text-template-${id}`))
      const parts = commits.at(-1)!.textItems!.filter(t => !beforeIds.has(t.id))
      expect(parts[0]!.startMs).toBe(4000)
      expect(parts[0]!.anim?.in).toBeUndefined()
      expect(parts[0]!.style.size).toBeGreaterThan(100)
    }
    const groups = commits.map((edit, i) => {
      const priorIds = new Set(i ? commits[i - 1]!.textItems!.map(t => t.id) : [])
      return edit.textItems!.filter(t => !priorIds.has(t.id))
    })
    expect(groups[1]![0]!.x !== groups[0]![0]!.x || groups[1]![0]!.y !== groups[0]![0]!.y).toBe(true)
    expect(groups[2]![0]!.x !== groups[0]![0]!.x || groups[2]![0]!.y !== groups[0]![0]!.y).toBe(true)
    expect(groups[0]!.find(t => t.text === '— Name')!.style.size).toBeGreaterThan(100)
  })

  it('E9: consecutive quote templates are visibly separated as intact groups', () => {
    const initial = defaultEdits({ clipStartMs: 0, clipEndMs: 60_000 })
    const log: typeof initial[] = []
    function Editor() {
      const [edits, setEdits] = useState(initial)
      return <TextPanel edits={edits} playheadMs={3000} durationMs={60_000}
        selectedId={null} onSelect={vi.fn()} onEdits={(next) => { log.push(next); setEdits(next) }} />
    }
    const ui = render(<Editor />)
    fireEvent.click(ui.getByTestId('text-template-c_qs_quote'))
    fireEvent.click(ui.getByTestId('text-template-c_qs_quote'))
    const first = log[0]!.textItems!
    const second = log[1]!.textItems!.filter(t => !first.some(old => old.id === t.id))
    expect(second).toHaveLength(3)
    expect(second[1]!.x !== first[1]!.x || second[1]!.y !== first[1]!.y).toBe(true)
    expect(second[1]!.style.size).toBeGreaterThan(100)
    expect(second[0]!.y - second[1]!.y).toBe(first[0]!.y - first[1]!.y)
  })

})

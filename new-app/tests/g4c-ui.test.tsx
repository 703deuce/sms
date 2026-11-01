// @vitest-environment happy-dom
/**
 * G4c web UI: Video tab tools (stabilize, scene split, blur regions), color match section, the
 * no-dollar rule on the new copy.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { useState } from 'react'
import { defaultEdits, editsPayloadForSave, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { MainVideoTools } from '@/components/clips/editor/g4/video-tools'
import { ColorMatchSection } from '@/components/clips/editor/g4/color-match-section'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
const base = () => normalizeEdits(defaultEdits(bounds), bounds)

function Tools({ onEdits }: { onEdits: (e: ClipEditsV2) => void }) {
  const [edits, setEdits] = useState<ClipEditsV2>(base())
  return (
    <MainVideoTools
      edits={edits}
      videoItem={{ srcInMs: 0, srcOutMs: 20000 }}
      outputMs={2000}
      durationMs={20000}
      onCommit={(e) => {
        setEdits(e)
        onEdits(e)
      }}
      onSeekOutput={() => {}}
    />
  )
}

describe('G4c Video tab tools', () => {
  it('stabilize on/off, blur region add + faces mode, all persisted through normalize', () => {
    const seen: ClipEditsV2[] = []
    const r = render(<Tools onEdits={(e) => seen.push(e)} />)
    expect(r.getByTestId('scene-split-detect')).toBeTruthy()
    fireEvent.click(r.getByTestId('stabilize-on'))
    let last = seen[seen.length - 1]!
    expect(last.stabilize).toEqual([{ fromMs: 0, toMs: 20000, amount: 50 }])
    fireEvent.click(r.getByTestId('blur-add'))
    last = seen[seen.length - 1]!
    expect(last.blurRegions?.[0]).toMatchObject({ startMs: 2000, mode: 'manual', amount: 60 })
    fireEvent.click(r.getByTestId('blur-mode-faces'))
    last = seen[seen.length - 1]!
    expect(last.blurRegions?.[0]?.mode).toBe('faces')
    expect(r.getByTestId('blur-faces-note').textContent).toMatch(/export/i)
    const saved = normalizeEdits(JSON.parse(JSON.stringify(editsPayloadForSave(last))), bounds)
    expect(saved.stabilize).toEqual(last.stabilize)
    expect(saved.blurRegions).toEqual(last.blurRegions)
    fireEvent.click(r.getByTestId('stabilize-off'))
    expect(seen[seen.length - 1]!.stabilize).toBeUndefined()
    expect(r.container.textContent).not.toContain('$')
  })
})

describe('G4c color match section', () => {
  it('match is disabled until a reference is set; no dollar sign', () => {
    const onCommit = vi.fn()
    const r = render(<ColorMatchSection edits={base()} target={{ kind: 'video' }} spec={{}} outputMs={0} onCommit={onCommit} />)
    expect((r.getByTestId('color-match-apply') as HTMLButtonElement).disabled).toBe(true)
    expect((r.getByTestId('color-match-set-ref') as HTMLButtonElement).disabled).toBe(false)
    expect(r.container.textContent).not.toContain('$')
    r.unmount()
    const a = render(<ColorMatchSection edits={base()} target={{ kind: 'adjust' }} spec={{}} outputMs={0} onCommit={onCommit} />)
    expect((a.getByTestId('color-match-set-ref') as HTMLButtonElement).disabled).toBe(true)
  })
})

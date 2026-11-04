// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { TextPanel } from '@/components/clips/editor/text-panel'
import { defaultEdits } from '@/lib/clips/edits'

afterEach(cleanup)

describe('TextPanel multi-part templates', () => {
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
})

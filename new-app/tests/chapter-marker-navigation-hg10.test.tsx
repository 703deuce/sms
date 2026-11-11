// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ScriptMarkerListPopover } from '@/components/script-editor/markers/script-marker-list-popover'

afterEach(cleanup)

describe('HG10 chapter marker navigation', () => {
  it('clicking the final generated chapter uses its output-clock timestamp', async () => {
    const seek = vi.fn()
    render(<ScriptMarkerListPopover
      document={{
        v: 1, keptWordIds: [], deletedWordIds: [],
        markers: [
          { id: 'intro', outMs: 0, label: 'Introduction', exportAsChapter: true },
          { id: 'last', outMs: 248000, label: 'Last chapter', exportAsChapter: true },
        ],
      }}
      playheadOutMs={0}
      durationMs={300000}
      onSeek={seek}
    />)
    fireEvent.click(screen.getByTestId('marker-list-button'))
    fireEvent.click(await screen.findByRole('button', { name: /Last chapter/ }))
    expect(seek).toHaveBeenCalledWith(248000)
  })
})

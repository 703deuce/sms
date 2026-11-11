// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TimelineToolbarChrome, type TimelineToolbarChromeProps } from '@/components/clips/editor/timeline/timeline-toolbar-chrome'

afterEach(() => cleanup())

describe('HG02 nested Takes toolbar interaction', () => {
  it('closes the existing More dropdown after a Takes action and can reopen it', async () => {
    const group = vi.fn()
    const props = {
      editable: true,
      tool: 'select',
      takesMenuBody: (
        <button data-testid="timeline-toolbar-group-takes" type="button" onClick={group}>
          Group as takes
        </button>
      ),
    } as unknown as TimelineToolbarChromeProps
    render(<TimelineToolbarChrome {...props} />)
    fireEvent.click(screen.getByTestId('timeline-more-menu'))
    const action = await screen.findByTestId('timeline-toolbar-group-takes')
    fireEvent.click(action)
    expect(group).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByTestId('timeline-toolbar-group-takes')).toBeNull())
    fireEvent.click(screen.getByTestId('timeline-more-menu'))
    expect(await screen.findByTestId('timeline-toolbar-group-takes')).toBeTruthy()
  })
})

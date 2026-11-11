// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PreviewTransportStrip } from '@/components/clips/editor/preview-transport-strip'

afterEach(cleanup)

describe('HG07 preview controls keyboard behavior', () => {
  it('keeps Full screen and Quality available and closes the View dropdown on Escape', async () => {
    const fullscreen = vi.fn()
    render(<PreviewTransportStrip
      recordSlot={<span>Record</span>}
      transportSlot={<span>Play</span>}
      viewSummary="Quality Full"
      fullscreenSlot={<button type="button" data-testid="preview-fullscreen" onClick={fullscreen}>Full screen</button>}
      viewMenuBody={<button type="button" data-testid="preview-quality">Quality: Full</button>}
    />)
    fireEvent.click(screen.getByTestId('preview-fullscreen'))
    expect(fullscreen).toHaveBeenCalledOnce()
    const view = screen.getByTestId('preview-view-menu')
    fireEvent.click(view)
    expect(await screen.findByTestId('preview-quality')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('preview-view-menu-content')).toBeNull())
    expect(screen.getByTestId('preview-fullscreen')).toBeTruthy()
  })
})

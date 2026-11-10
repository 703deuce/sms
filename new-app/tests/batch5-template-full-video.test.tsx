// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { TemplatesPanel } from '@/components/clips/editor/templates-panel'
import { OpenInFullVideoButton } from '@/components/clips/editor/open-in-full-video-button'
import { defaultEdits } from '@/lib/clips/edits'

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/video-editor/project/edit/clip',
  useRouter: () => ({ push: vi.fn() }),
}))
afterEach(() => cleanup())

describe('Batch 5 editor surface', () => {
  it('N4 removes background-removal from Templates while keeping actual templates', () => {
    const ui = render(<TemplatesPanel
      edits={defaultEdits({ clipStartMs: 0, clipEndMs: 20_000 })}
      onEdits={vi.fn()}
      layoutSlot={<div>Layouts available</div>}
      brandTemplates={[]}
      onApplyBrand={vi.fn()}
      playheadMs={3000}
      durationMs={20_000}
    />)
    expect(ui.queryByTestId('bg-remove-toggle')).toBeNull()
    expect(ui.getByTestId('templates-starters')).toBeTruthy()
    expect(ui.getByTestId('templates-layouts')).toBeTruthy()
  })

  it('C5 shows a readable full-video action at laptop width instead of icon-only', () => {
    const ui = render(<OpenInFullVideoButton clipId="clip1" />)
    const action = ui.getByTestId('open-in-full-video')
    expect(action.textContent).toContain('Open in full video')
    expect(action.querySelector('span')?.className).not.toContain('sr-only')
  })
})

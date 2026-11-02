// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrandTemplatesManager } from '@/components/clips/brand-templates-manager'

vi.mock('@/lib/clips-api', () => ({
  clipsFetch: vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes('/api/clips/brand/templates') && init?.method !== 'POST') {
      return {
        items: [
          { id: 't1', name: 'Default', isDefault: true, introVideoKey: null, outroVideoKey: null },
          { id: 't2', name: 'Alt', isDefault: false, introVideoKey: null, outroVideoKey: null },
        ],
      }
    }
    if (String(url).includes('action=set-default')) {
      return {}
    }
    return {}
  }),
}))

describe('brand template open', () => {
  it('row opens template; set default does not', async () => {
    const onOpen = vi.fn()

    render(<BrandTemplatesManager onOpen={onOpen} />)
    const rows = await screen.findAllByTestId('brand-template-row')
    expect(rows).toHaveLength(2)
    fireEvent.click(rows[1]!)
    expect(onOpen).toHaveBeenCalledWith('t2')
    onOpen.mockClear()
    fireEvent.click(screen.getByText('Set default'))
    expect(onOpen).not.toHaveBeenCalled()
    fireEvent.keyDown(rows[1]!, { key: 'Enter' })
    expect(onOpen).toHaveBeenCalledWith('t2')
    await waitFor(() => expect(onOpen).toHaveBeenCalledTimes(1))
  })
})

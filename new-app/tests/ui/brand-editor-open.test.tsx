// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrandEditor } from '@/app/app/clips/(drive)/brand/brand-editor'

const replace = vi.fn()
const clipsFetchMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams('tab=templates'),
  usePathname: () => '/app/clips/brand',
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@/lib/clips-api', () => ({
  clipsFetch: (...args: unknown[]) => clipsFetchMock(...args),
}))

vi.mock('@/components/clips/brand-templates-manager', () => ({
  BrandTemplatesManager: ({ onOpen }: { onOpen?: (id: string) => void }) => (
    <button type="button" data-testid="mock-open-t2" onClick={() => onOpen?.('t2')}>
      Open T2
    </button>
  ),
}))

describe('BrandEditor template open', () => {
  beforeEach(() => {
    replace.mockClear()
    clipsFetchMock.mockReset()
    clipsFetchMock.mockResolvedValue({
      template: {
        name: 'T2 test',
        settings: {
          logoPosition: 'BR',
          logoSizePct: 10,
          logoOpacity: 1,
          captionPreset: { presetId: 'classic', position: 'bottom' },
          defaultMusicMood: '',
          primaryColor: '#ffffff',
        },
        logoKey: null,
        isDefault: false,
        headingFont: 'Inter',
        captionFont: 'Inter',
        palette: ['#111827'],
        watermarkKey: null,
        watermarkPosition: 'BR',
        watermarkOpacity: 0.8,
        watermarkSizePct: 12,
      },
      logoUrl: null,
    })
  })

  it('row open requests template by id and updates editing banner', async () => {
    render(<BrandEditor initialTab="templates" initialTemplateId={null} />)
    await waitFor(() => expect(screen.getByTestId('mock-open-t2')).toBeTruthy())
    fireEvent.click(screen.getByTestId('mock-open-t2'))
    expect(replace).toHaveBeenCalledWith('/app/clips/brand?id=t2')
    expect(screen.getByTestId('brand-editing-banner')).toBeTruthy()
    await waitFor(() => expect(clipsFetchMock).toHaveBeenCalledWith('/api/clips/brand?id=t2'))
    await waitFor(() => {
      expect(screen.getByTestId('brand-editing-banner').textContent).toContain('T2 test')
    })
  })
})

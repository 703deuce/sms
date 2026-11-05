// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { defaultEdits } from '@/lib/clips/edits'
import { defaultBrandSettings } from '@/lib/clips/brand'
import { BrandPanel } from '@/components/clips/editor/brand-panel'
import { clipsFetch } from '@/lib/clips-api'

vi.mock('@/lib/clips-api', () => ({ clipsFetch: vi.fn() }))
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, items, onValueChange }: { children: React.ReactNode; items: {value:string;label:string}[]; onValueChange:(v:string)=>void }) =>
    <div>{items.map((item) => <button key={item.value} type="button" data-testid={`choose-${item.value}`} onClick={() => onValueChange(item.value)}>{item.label}</button>)}{children}</div>,
  SelectContent: ({ children }: {children:React.ReactNode}) => <div>{children}</div>,
  SelectItem: ({ children }: {children:React.ReactNode}) => <div>{children}</div>,
  SelectTrigger: ({ children }: {children:React.ReactNode}) => <div>{children}</div>,
  SelectValue: () => <span>Selected kit</span>,
}))

const kit = { id: 'brand_T22', name: 'T22', isDefault: true, logoKey: null, introVideoKey: null, outroVideoKey: null, settings: defaultBrandSettings() }
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('Batch 4 F30/F31 — brand kit selection and bumper activation', () => {
  it('browsing a brand kit never applies its layout/aspect/captions until Apply kit', async () => {
    vi.mocked(clipsFetch).mockResolvedValue({items:[kit]} as never)
    const onEdits = vi.fn()
    const ui = render(<BrandPanel edits={defaultEdits({clipStartMs:0,clipEndMs:31_000})} onEdits={onEdits} />)
    await waitFor(() => expect(ui.getByTestId('choose-brand_T22')).toBeTruthy())
    fireEvent.click(ui.getByTestId('choose-brand_T22'))
    expect(ui.getByTestId('brand-template-preview').textContent).toContain('Preview only')
    expect(onEdits).not.toHaveBeenCalled()
    fireEvent.click(ui.getByTestId('brand-template-apply'))
    expect(onEdits).toHaveBeenCalledTimes(1)
    expect(onEdits.mock.calls[0][0].brand.templateId).toBe('brand_T22')
  })

  it('exposes an upload path when an applied kit has no intro/outro media', async () => {
    vi.mocked(clipsFetch).mockResolvedValue({items:[kit]} as never)
    const edits = { ...defaultEdits({clipStartMs:0,clipEndMs:31_000}),brand:{templateId:'brand_T22'} }
    const ui = render(<BrandPanel edits={edits} onEdits={vi.fn()} />)
    await waitFor(() => expect(ui.getByTestId('brand-upload-intro')).toBeTruthy())
    expect(ui.getByTestId('brand-upload-outro')).toBeTruthy()
    expect(ui.getByTestId('brand-bumper-upload-hint').textContent).toContain('MP4')
  })
})

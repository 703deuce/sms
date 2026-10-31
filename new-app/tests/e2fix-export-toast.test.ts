import { describe, expect, it, vi } from 'vitest'
import { createExportToast, type ExportToastApi } from '@/lib/clips/editor/export-toast'

function fakeToast() {
  let n = 0
  const open = new Map<string | number, string>()
  const kinds = new Map<string | number, string>()
  const put = (kind: string) => (msg: string, opts?: { id?: string | number }) => {
    const id = opts?.id ?? `t${++n}`
    open.set(id, msg)
    kinds.set(id, kind)
    return id
  }
  const api: ExportToastApi = {
    loading: vi.fn(put('loading')),
    success: vi.fn(put('success')),
    error: vi.fn(put('error')),
    dismiss: vi.fn((id?: string | number) => {
      if (id != null) open.delete(id)
    }),
  }
  const loadingOpen = () => [...open.keys()].filter((id) => kinds.get(id) === 'loading')
  return { api, open, loadingOpen }
}

describe('E2fix: export toast lifecycle', () => {
  it('Starting → Rendering → READY is ONE toast that ends as success (no stuck spinner)', () => {
    const f = fakeToast()
    const t = createExportToast(f.api)
    t.start()
    t.rendering()
    expect(f.loadingOpen()).toHaveLength(1)
    t.ready()
    expect(f.loadingOpen()).toHaveLength(0)
    expect(f.open.size).toBe(1)
    expect([...f.open.values()][0]).toMatch(/Export ready/)
  })

  it('FAILED and poll errors settle the same toast as an error', () => {
    const f = fakeToast()
    const t = createExportToast(f.api)
    t.start()
    t.rendering()
    t.failed('Render crashed')
    expect(f.loadingOpen()).toHaveLength(0)
    expect([...f.open.values()]).toEqual(['Render crashed'])
  })

  it('closing the dialog mid-render dismisses the spinner; a settled toast is left alone', () => {
    const f = fakeToast()
    const t = createExportToast(f.api)
    t.start()
    t.rendering()
    t.dismiss()
    expect(f.open.size).toBe(0)
    t.start()
    t.ready('Export ready')
    t.dismiss()
    expect(f.open.size).toBe(1)
    t.ready() // a late duplicate READY poll does not raise a second toast
    expect(f.api.success).toHaveBeenCalledTimes(1)
  })
})

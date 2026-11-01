import { describe, expect, it, vi } from 'vitest'
import { can } from '@/lib/billing/entitlements'

vi.mock('@/lib/billing/entitlements', () => ({
  can: vi.fn(() => true),
}))

/** EX-23: same expression as export route (§2.5). */
function resolveExportWatermark(workspaceId: string, body: { watermark?: boolean }) {
  return can(workspaceId, 'no_watermark') ? (body.watermark ?? false) : true
}

describe('export route watermark (EX-23)', () => {
  it('no no_watermark + watermark:false → true', () => {
    vi.mocked(can).mockImplementation((_w, f) => f !== 'no_watermark')
    expect(resolveExportWatermark('ws', { watermark: false })).toBe(true)
  })

  it('with no_watermark + absent body → false', () => {
    vi.mocked(can).mockImplementation((_w, f) => f === 'no_watermark')
    expect(resolveExportWatermark('ws', {})).toBe(false)
  })
})

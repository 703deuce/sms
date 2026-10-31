import { afterEach, describe, expect, it, vi } from 'vitest'
import { clipsNavItems } from '@/lib/nav'

const hrefs = (opts?: Parameters<typeof clipsNavItems>[0]) => clipsNavItems(opts).map((i) => i.href)

describe('Rooms nav entry (E1)', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('shows Rooms when recording is on even with the script editor paused', () => {
    vi.stubEnv('NEXT_PUBLIC_SCRIPT_EDITOR_ENABLED', '')
    vi.stubEnv('SCRIPT_EDITOR_ENABLED', '')
    expect(hrefs({ showRecording: true })).toContain('/app/rooms/new')
    // index page is still a stub that redirects to /new — keep it hidden
    expect(hrefs({ showRecording: true })).not.toContain('/app/rooms')
  })

  it('hides Rooms when recording (LiveKit) is off', () => {
    expect(hrefs({ showRecording: false })).not.toContain('/app/rooms/new')
  })
})

import { describe, expect, it } from 'vitest'
import {
  mergeWatchdogSnap,
  phaseStallLimitMs,
  progressStallExceeded,
  canAutoRetryWatchdog,
} from '@/lib/clips/clipper-watchdog'

describe('clipper-watchdog', () => {
  it('uses longer limits for transcribe and render', () => {
    expect(phaseStallLimitMs('RENDER_CLIP', 'render_clip')).toBe(20 * 60_000)
    expect(phaseStallLimitMs('PROCESS', 'transcribing')).toBe(45 * 60_000)
  })

  it('detects progress stall from lastChangeAt', () => {
    const snap = mergeWatchdogSnap(null, 'render_clip', 10, Date.now() - 25 * 60_000)
    expect(progressStallExceeded(snap, 'RENDER_CLIP', Date.now())).toBe(true)
  })

  it('allows one auto retry', () => {
    expect(canAutoRetryWatchdog(0)).toBe(true)
    expect(canAutoRetryWatchdog(1)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import {
  activeRenderToResume,
  exportButtonState,
  RESUME_LOOKUP_MAX_WAIT_MS,
} from '@/lib/clips/editor/export-progress-text'

const base = { lookupPending: false, busy: false, renderInFlight: false, inFlightResolution: null, selectedResolution: '1080p' }

describe('FV4d activeRenderToResume carries the render settings', () => {
  it('keeps valid resolution / aspect, drops unknown ones', () => {
    expect(
      activeRenderToResume({ render: { id: 'rnd_1', status: 'RENDERING', resolution: '720p', aspectRatio: '16:9' } }),
    ).toEqual({ renderId: 'rnd_1', status: 'RENDERING', resolution: '720p', aspectRatio: '16:9' })
    expect(
      activeRenderToResume({ render: { id: 'rnd_1', status: 'QUEUED', resolution: '4k', aspectRatio: '2:1' } }),
    ).toEqual({ renderId: 'rnd_1', status: 'QUEUED', resolution: null, aspectRatio: null })
  })
})

describe('FV4d exportButtonState', () => {
  it('nothing in flight → Export MP4 enabled, no note', () => {
    expect(exportButtonState(base)).toEqual({ label: 'Export MP4', disabled: false, note: null, blockedByInFlight: false })
  })
  it('lookup pending → Checking… disabled (never a fresh Export MP4 flash)', () => {
    const s = exportButtonState({ ...base, lookupPending: true })
    expect(s.label).toBe('Checking…')
    expect(s.disabled).toBe(true)
    expect(RESUME_LOOKUP_MAX_WAIT_MS).toBeLessThanOrEqual(2000)
  })
  it('in flight at the selected resolution → Rendering… disabled', () => {
    const s = exportButtonState({ ...base, renderInFlight: true, inFlightResolution: '720p', selectedResolution: '720p' })
    expect(s).toEqual({ label: 'Rendering…', disabled: true, note: null, blockedByInFlight: true })
  })
  it('in flight with unknown resolution → still blocked', () => {
    const s = exportButtonState({ ...base, renderInFlight: true, inFlightResolution: null })
    expect(s.label).toBe('Rendering…')
    expect(s.disabled).toBe(true)
  })
  it('another resolution selected → Export allowed with a note', () => {
    const s = exportButtonState({ ...base, renderInFlight: true, inFlightResolution: '720p', selectedResolution: '1080p' })
    expect(s.label).toBe('Export MP4')
    expect(s.disabled).toBe(false)
    expect(s.blockedByInFlight).toBe(false)
    expect(s.note).toBe('A 720p export is rendering — you can start another resolution.')
  })
  it('busy wins over the note (Exporting…)', () => {
    const s = exportButtonState({ ...base, busy: true, renderInFlight: true, inFlightResolution: '720p' })
    expect(s.label).toBe('Exporting…')
    expect(s.disabled).toBe(true)
  })
  it('no $ / cost text anywhere', () => {
    const s = exportButtonState({ ...base, renderInFlight: true, inFlightResolution: '720p' })
    expect(JSON.stringify(s)).not.toMatch(/\$|cost|credit/i)
  })
})

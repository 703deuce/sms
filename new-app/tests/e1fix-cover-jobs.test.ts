import { describe, expect, it } from 'vitest'
import { coverJobActive, coverJobNotice, coverPollMs } from '@/lib/clips/editor/cover-jobs'

describe('E1fix bug 3: Cover job tracking', () => {
  it('no notice while the job is queued / running / not listed yet', () => {
    expect(coverJobNotice('job_1', [], [])).toBeNull()
    expect(coverJobNotice('job_1', [{ id: 'job_1', status: 'QUEUED' }], [])).toBeNull()
    expect(coverJobNotice('job_1', [{ id: 'job_1', status: 'RUNNING' }], [])).toBeNull()
    expect(coverJobActive('RUNNING')).toBe(true)
  })

  it('a failed job always surfaces its error', () => {
    const n = coverJobNotice('job_1', [{ id: 'job_1', status: 'FAILED', error: 'KIE_CALLBACK_SECRET missing' }], [])
    expect(n?.kind).toBe('error')
    expect(n?.message).toContain('KIE_CALLBACK_SECRET missing')
    expect(coverJobNotice('job_1', [{ id: 'job_1', status: 'CANCELED' }], [])?.kind).toBe('error')
  })

  it('done with images -> success; done but nothing -> error', () => {
    const items = [{ id: 'th', status: 'READY', downloadUrl: 'https://x/y.png' }]
    expect(coverJobNotice('job_1', [{ id: 'job_1', status: 'DONE' }], items)?.kind).toBe('success')
    expect(coverJobNotice('job_1', [{ id: 'job_1', status: 'DONE' }], [])?.kind).toBe('error')
    const rendering = [{ id: 'th', status: 'RUNNING', downloadUrl: null }]
    expect(coverJobNotice('job_1', [{ id: 'job_1', status: 'DONE' }], rendering)?.kind).toBe('info')
  })

  it('polls fast while running', () => {
    expect(coverPollMs([{ id: 'j', status: 'RUNNING' }], [])).toBe(3000)
    expect(coverPollMs([{ id: 'j', status: 'DONE' }], [{ id: 't', status: 'READY', downloadUrl: 'u' }])).toBe(15000)
  })
})

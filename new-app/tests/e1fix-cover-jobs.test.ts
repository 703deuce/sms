import { describe, expect, it } from 'vitest'
import { coverImageClass, coverJobActive, coverJobNotice, coverPollMs, stableCoverItems } from '@/lib/clips/editor/cover-jobs'

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

  it('HG13 mixed success preserves the two ready covers and the failed variant', () => {
    const rows = [
      { id: 'ok1', status: 'READY', downloadUrl: 'signed1' },
      { id: 'fail', status: 'FAILED', error: 'Image could not be rendered', downloadUrl: null },
      { id: 'ok2', status: 'READY', downloadUrl: 'signed2' },
    ]
    const kept = stableCoverItems(rows, new Map(), 1000)
    expect(kept).toHaveLength(3)
    expect(kept.filter((row) => row.downloadUrl)).toHaveLength(2)
    expect(kept[1].error).toBe('Image could not be rendered')
    expect(coverJobNotice('j', [{ id: 'j', status: 'DONE' }], kept)?.kind).toBe('success')
  })

  it('HG14 portrait cover preview is aspect-correct and never fills via crop', () => {
    expect(coverImageClass('9:16')).toContain('aspect-[9/16]')
    expect(coverImageClass('9:16')).toContain('object-contain')
    expect(coverImageClass('16:9')).toContain('aspect-video')
    expect(coverImageClass('16:9')).toContain('object-contain')
  })

  it('polls fast while running', () => {
    expect(coverPollMs([{ id: 'j', status: 'RUNNING' }], [])).toBe(3000)
    expect(coverPollMs([{ id: 'j', status: 'DONE' }], [{ id: 't', status: 'READY', downloadUrl: 'u' }])).toBe(15000)
  })
})

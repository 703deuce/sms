import { describe, expect, it } from 'vitest'
import { youtubeOutputIdentity } from '@/lib/server/youtube-video/output'

describe('YouTube deterministic output identity',()=>{
  it('replays the same run and choice to the same project, clip, render and job',()=>{
    const first=youtubeOutputIdentity('ws_1','yvrun_1','opt_a')
    expect(youtubeOutputIdentity('ws_1','yvrun_1','opt_a')).toEqual(first)
    expect(new Set(Object.values(first)).size).toBe(4)
  })

  it('gives a second different choice a different output boundary',()=>{
    const first=youtubeOutputIdentity('ws_1','yvrun_1','opt_a')
    const second=youtubeOutputIdentity('ws_1','yvrun_1','opt_b')
    expect(second.projectId).not.toBe(first.projectId)
    expect(second.clipId).not.toBe(first.clipId)
    expect(second.renderId).not.toBe(first.renderId)
    expect(second.jobId).not.toBe(first.jobId)
  })
})

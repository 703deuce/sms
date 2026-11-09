import { describe, expect, it } from 'vitest'
import { buildProcessProjectJobPayload } from '@/lib/server/clips/process-project-payload'
import { defaultClipSettings } from '@/lib/clips/settings'

describe('buildProcessProjectJobPayload', () => {
  it('non-BYO payload matches pinned snapshot (byte-identical job fields)', () => {
    const settings = defaultClipSettings()
    expect(buildProcessProjectJobPayload(settings)).toMatchInlineSnapshot(`
      {
        "genre": "auto",
        "mode": "auto",
        "target_clip_len_s": null,
      }
    `)
  })

  it('BYO adds only byo:true', () => {
    const base = buildProcessProjectJobPayload(defaultClipSettings())
    const byo = buildProcessProjectJobPayload(defaultClipSettings({ byo: true }))
    expect(byo).toEqual({ ...base, byo: true })
  })
  it('agent-only mode transcribes without classic picking',()=>{
    expect(buildProcessProjectJobPayload(defaultClipSettings({
      autoAgentClipMode:'clip_moment_v1',autoAgentClipSeconds:30,
    }))).toMatchObject({agentOnly:true,agentClipMode:'clip_moment_v1',agentClipSeconds:30})
    expect(buildProcessProjectJobPayload(defaultClipSettings({
      autoAgentClipMode:'clip_story_v1',
    }))).toMatchObject({agentOnly:true,agentClipMode:'clip_story_v1',agentClipSeconds:60})
  })
  it('existing full-video and BYO settings take priority over agent-only',()=>{
    for(const extra of [{byo:true},{fullVideo:true}]){
      const payload=buildProcessProjectJobPayload(defaultClipSettings({
        autoAgentClipMode:'clip_moment_v1',...extra,
      }))
      expect(payload).not.toHaveProperty('agentOnly')
    }
    expect(buildProcessProjectJobPayload(defaultClipSettings())).not.toHaveProperty('agentOnly')
  })
})

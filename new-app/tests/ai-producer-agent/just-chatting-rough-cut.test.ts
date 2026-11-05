import { describe, expect, it } from 'vitest'
import { roughCutSourceWindow } from '@/lib/ai-producer-agent/rough-cut-window'
import { buildAgentSystemPromptForModel } from '@/lib/ai-producer-agent/prompts'
import { DraftEditsBuilder } from '@/lib/ai-producer-agent/draft-edits'
import { validateDraft } from '@/lib/ai-producer-agent/validate'
import { planOutputs } from '@/lib/ai-producer-agent/multi-edit'
import type { ToolCtx } from '@/lib/ai-producer-agent/tools/registry'

const source = { sourceId: 'raw_stream', kind: 'clip' as const,
  clipId: 'clip_1', projectId: 'project_1', rangeMs: [0, 75 * 60_000] as [number, number] }

describe('Just Chatting long-form rough cut', () => {
  it('selects the last twenty minutes without resetting the source timebase', () => {
    const window = roughCutSourceWindow(source)
    expect(window.rangeMs).toEqual([55 * 60_000, 75 * 60_000])
    expect(window.durationMs).toBe(20 * 60_000)
    expect(roughCutSourceWindow({ ...source, rangeMs: [5000, 9 * 60_000] }).rangeMs)
      .toEqual([5000, 9 * 60_000])
    expect(() => roughCutSourceWindow({ ...source, rangeMs: [0, 120_000] })).toThrow('rough_cut_requires_five_minutes')
  })

  it('loads a distinct editorial skill, not the 15s shorts rulepack', () => {
    const prompt = buildAgentSystemPromptForModel({
      genre: 'irl_just_chatting', outputType: 'story', platform: 'shorts',
      editMode: 'just_chatting_rough_cut',
    })
    expect(prompt).toContain('Just Chatting long-form rough cut')
    expect(prompt).toContain('20-minute')
    expect(prompt).toContain('chronologically ordered')
    expect(prompt).toContain('review')
    expect(prompt).not.toContain('single payoff target 15')
    const short = buildAgentSystemPromptForModel({
      genre: 'irl_just_chatting', outputType: 'single_payoff', platform: 'tiktok',
    })
    expect(short).toContain('15-30')
  })

  it('creates exactly one long-form output rather than multiple viral clips', () => {
    const config = {
      editMode: 'just_chatting_rough_cut' as const,
      targetLengthS: [180, 480] as [number, number],
      music: 'none' as const, memeSfx: 'off' as const,
      exportOnFinish: false, geminiUsdCap: 3, maxEditsPerRun: 1,
    }
    const ctx = { cache: { moments: Array.from({ length: 18 }, (_,i) => ({score:0.99,id:i})) },
      totalSourceMs: 1_200_000, decideInput: {instruction:null,momentCount:18,multiSource:false} } as unknown as ToolCtx
    expect(planOutputs(ctx, { outputType: 'story', config })).toEqual(['story'])
  })

  it('validates the real EDL length, chronology and human audio audition requirement', () => {
    const start = 55 * 60_000
    const end = 75 * 60_000
    const builder = new DraftEditsBuilder(
      {clipStartMs:start,clipEndMs:end,trimMinMs:start,trimMaxMs:end},
      'raw_stream',
    )
    builder.addSegment({sourceId:'raw_stream',srcInMs:start+5000,srcOutMs:start+85_000,beat:'setup'})
    builder.addSegment({sourceId:'raw_stream',srcInMs:start+165_000,srcOutMs:start+265_000,beat:'build'})
    builder.addSegment({sourceId:'raw_stream',srcInMs:start+450_000,srcOutMs:start+595_000,beat:'payoff'})
    const report = validateDraft(builder, {
      words:[],laughs:[],reactions:[],bursts:[],layoutAt:()=>null,
      outputType:'story',editMode:'just_chatting_rough_cut',
      sourceRangeMs:[start,end],audioEvidenceAvailable:false,
      targetLengthS:[180,480],memeSfx:'off',payoffSrc:[],
    })
    expect(report.hardFailures).toEqual([])
    expect(report.warnings.map(x=>x.code)).toContain('audio_join_listening_required')
    const reverse = new DraftEditsBuilder(
      {clipStartMs:start,clipEndMs:end,trimMinMs:start,trimMaxMs:end},'raw_stream')
    reverse.addSegment({sourceId:'raw_stream',srcInMs:start+550_000,srcOutMs:start+650_000})
    reverse.addSegment({sourceId:'raw_stream',srcInMs:start+5_000,srcOutMs:start+225_000})
    const bad = validateDraft(reverse, {
      words:[],laughs:[],reactions:[],bursts:[],layoutAt:()=>null,
      outputType:'story',editMode:'just_chatting_rough_cut',
      sourceRangeMs:[start,end],audioEvidenceAvailable:false,
      targetLengthS:[180,480],memeSfx:'off',payoffSrc:[],
    })
    expect(bad.hardFailures.map(x=>x.code)).toContain('rough_cut_non_chronological_or_overlapping')
  })
})

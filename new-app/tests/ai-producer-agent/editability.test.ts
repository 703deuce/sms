import { describe, expect, it } from 'vitest'
import { aiProducerAgentDisabledResponse } from '@/lib/server/ai-producer-agent/api-guard'
import { DraftEditsBuilder } from '@/lib/ai-producer-agent/draft-edits'
import { normalizeEdits, type ClipBounds } from '@/lib/clips/edits'
import type { EditPlanJson } from '@/lib/ai-producer-agent/types'

describe('AI Producer API guard', () => {
  it('returns 404 when flag off', () => {
    const prev = process.env.AI_PRODUCER_AGENT_ENABLED
    delete process.env.AI_PRODUCER_AGENT_ENABLED
    delete process.env.NEXT_PUBLIC_AI_PRODUCER_AGENT
    const res = aiProducerAgentDisabledResponse()
    expect(res?.status).toBe(404)
    if (prev) process.env.AI_PRODUCER_AGENT_ENABLED = prev
  })
})

describe('editability round-trip', () => {
  it('normalizeEdits preserves draft after plan apply', () => {
    const bounds: ClipBounds = { clipStartMs: 0, clipEndMs: 60_000 }
    const plan: EditPlanJson = {
      genre: 'irl_just_chatting',
      outputType: 'single_payoff',
      platform: 'tiktok',
      targetLengthS: [15, 30],
      story: 'x',
      segments: [{ id: 's1', sourceId: 'a', srcInMs: 1000, srcOutMs: 18_000, beat: 'payoff' }],
    }
    const b = new DraftEditsBuilder(bounds)
    b.applyPlan(plan)
    const saved = normalizeEdits(b.edits, bounds)
    const round = normalizeEdits(saved, bounds)
    expect(JSON.stringify(round)).toBe(JSON.stringify(saved))
  })
})

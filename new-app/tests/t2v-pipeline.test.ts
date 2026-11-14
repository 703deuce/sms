import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/server/t2v/pipeline/t2v-llm', () => ({ t2vLlmJson: vi.fn() }))

import { estimateNeedS, splitSentences } from '@/lib/server/t2v/pipeline/t2v-scene-planner'
import { wordBudget } from '@/lib/server/t2v/pipeline/t2v-story-agent'
import { t2vQaPlan } from '@/lib/server/t2v/pipeline/t2v-qa'
import type { T2vPipelineRun } from '@/lib/t2v/pipeline/t2v-types'
import type { T2vScene } from '@/lib/t2v/types'

describe('prompt-to-video scene planner helpers', () => {
  it('splits narration into sentences without changing words', () => {
    const text = 'Electric cars are everywhere now. Why? Charging is easier than ever before! Prices keep falling.'
    const parts = splitSentences(text)
    expect(parts.join(' ').replace(/\s+/g, ' ')).toBe(text)
    expect(parts).toEqual([
      'Electric cars are everywhere now. Why?',
      'Charging is easier than ever before! Prices keep falling.',
    ])
  })

  it('estimates shot length from spoken words', () => {
    expect(estimateNeedS('one two three four five six seven eight nine ten')).toBeCloseTo(4.5, 0)
  })

  it('budgets words for the full requested runtime (no end card)', () => {
    expect(wordBudget(90)).toBe(Math.round(90 * 2.3))
  })
})

describe('prompt-to-video QA', () => {
  const run: T2vPipelineRun = {
    v: 1,
    prompt: 'x',
    style: 'documentary',
    durationS: 30,
    renderResolution: '480p',
    status: 'verifying_footage',
    completed: [],
    log: [],
    startedAt: new Date().toISOString(),
    segments: [
      { id: 'seg_1', purpose: 'hook', narration: '', visualMeaning: '', targetSeconds: 0, emotion: '' },
      { id: 'seg_2', purpose: 'body', narration: '', visualMeaning: '', targetSeconds: 0, emotion: '' },
      { id: 'seg_3', purpose: 'end', narration: '', visualMeaning: '', targetSeconds: 0, emotion: '' },
    ],
  }
  const scene = (id: string, providerId: string, words: number): T2vScene => ({
    id,
    slot: 0,
    narration: Array.from({ length: words }, () => 'word').join(' '),
    keywords: [],
    visualQuery: '',
    media: { provider: 'pixabay', kind: 'video', providerId },
    padMs: 0,
    transition: 'cut',
    transitionMs: 0,
    texts: [],
  })

  it('flags repeated source clips', () => {
    const scenes = [scene('a', '1', 35), scene('b', '1', 34)]
    const qa = t2vQaPlan({ run, scenes, results: [] })
    expect(qa.checks.find((c) => c.id === 'no_repeated_clips')?.ok).toBe(false)
    expect(qa.checks.find((c) => c.id === 'no_back_to_back_repeat')?.ok).toBe(false)
  })

  it('passes a varied, on-budget edit', () => {
    const scenes = [scene('a', '1', 35), scene('b', '2', 34)]
    const qa = t2vQaPlan({ run, scenes, results: [] })
    expect(qa.checks.find((c) => c.id === 'narration_length')?.ok).toBe(true)
    expect(qa.checks.find((c) => c.id === 'no_repeated_clips')?.ok).toBe(true)
  })
})

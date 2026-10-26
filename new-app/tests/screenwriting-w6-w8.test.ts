import { describe, expect, it } from 'vitest'
import { handleLayoutRequest, pageLineToAnchor } from '@/lib/screenwriting/layout/worker-protocol'
import { FEATURE_FORMAT_SPEC } from '@/lib/screenwriting/formats/feature'
import type { LayoutElement } from '@/lib/screenwriting/layout/types'
import { applyFindReplace } from '@/lib/screenwriting/writing/find-replace'
import { checkScript } from '@/lib/screenwriting/writing/error-check'
import { overflowLabel } from '@/lib/screenwriting/layout/locks'
import { insertSceneLabel } from '@/lib/screenwriting/revisions/scene-numbers'

describe('layout worker protocol', () => {
  it('returns page anchors', () => {
    const els: LayoutElement[] = [
      { id: 'a', kind: 'action', elementType: 'action', text: 'Line one' },
    ]
    const res = handleLayoutRequest({
      type: 'layout-full',
      elements: els,
      options: { spec: FEATURE_FORMAT_SPEC },
    })
    expect(res.type).toBe('layout-result')
    if (res.type === 'layout-result') {
      const anchor = pageLineToAnchor(res.result, 0, 0)
      expect(anchor?.elementId).toBe('a')
    }
  })
})

describe('writing aids', () => {
  const doc = {
    type: 'doc',
    content: [
      { type: 'screenplayElement', attrs: { id: 'c', elementType: 'character' }, content: [{ type: 'text', text: 'JACK' }] },
      { type: 'screenplayElement', attrs: { id: 'd', elementType: 'dialogue' }, content: [{ type: 'text', text: 'hello jack' }] },
    ],
  }

  it('replace within character dialogue only', () => {
    const next = applyFindReplace(doc, {
      query: 'jack',
      replacement: 'there',
      scope: 'characterDialogue',
      characterName: 'JACK',
    })
    const dialogue = next.content?.[1]
    expect(dialogue?.content?.[0]?.text).toBe('hello there')
  })

  it('flags character without dialogue', () => {
    const issues = checkScript({
      type: 'doc',
      content: [
        { type: 'screenplayElement', attrs: { id: 'c', elementType: 'character' }, content: [{ type: 'text', text: 'BOB' }] },
        { type: 'screenplayElement', attrs: { id: 'a', elementType: 'action' }, content: [{ type: 'text', text: 'Cut' }] },
      ],
    })
    expect(issues.some((i) => i.code === 'character_without_dialogue')).toBe(true)
  })
})

describe('locks and scene numbers', () => {
  it('overflow label A/B', () => {
    expect(overflowLabel('12', 0, 1)).toBe('12A')
    expect(overflowLabel('12', 1, 1)).toBe('12B')
  })

  it('insert scene 5A', () => {
    expect(insertSceneLabel(['5', '6'], '5')).toBe('5A')
    expect(insertSceneLabel(['5', '5A', '6'], '5')).toBe('5B')
  })
})

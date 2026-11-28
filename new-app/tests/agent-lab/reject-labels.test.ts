import { describe, expect, it } from 'vitest'
import { isContextRestoreRejection, toAgentLabItems } from '@/lib/server/agent-lab'

const reject = (reason: string) => ({ id: 'e1', timestamp: '2026-11-28T14:00:00Z', kind: 'UserRejectObservation', source: 'environment', tool_name: 'terminal', rejection_reason: reason })

describe('rejected tool call labels', () => {
  it('detects context-restore rejections only', () => {
    expect(isContextRestoreRejection('Not executed: the context was condensed; restoring the last state first.')).toBe(true)
    expect(isContextRestoreRejection('Blocked: rm -rf outside the job folder')).toBe(false)
    expect(isContextRestoreRejection('Not executed: command not allowed')).toBe(false)
  })

  it('labels context restore calmly and keeps the safety guard label for real blocks', () => {
    const calm = toAgentLabItems([reject('Not executed: context was condensed, re-reading the brief.')] as never)
    expect(calm.some((i) => i.title === 'Restoring context' && !i.isError && i.type !== 'error')).toBe(true)
    const blocked = toAgentLabItems([reject('Deleting files outside the workspace is not allowed')] as never)
    expect(blocked.some((i) => i.title === 'Blocked by safety guard' && i.isError)).toBe(true)
  })
})

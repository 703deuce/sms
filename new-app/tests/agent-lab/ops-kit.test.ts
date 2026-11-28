import { describe, expect, it } from 'vitest'
import { plainError, plainSummary } from '@/components/agent-lab/ops/ops-kit'

describe('customer-facing text', () => {
  it('turns raw JSON permission errors into a plain sentence', () => {
    const raw = '{\n "error": {\n "code": 403,\n "message": "The caller does not have permission",\n "status": "PERMISSION_DENIED"\n }\n}'
    expect(plainError(raw)).toBe("The connected account doesn't allow that action, so it finished what it could.")
  })
  it('hides internal wording such as keys and cost', () => {
    expect(plainError('agent reported error: Your LLM API key appears to be invalid or has expired.')).toMatch(/couldn't fix on its own/)
    expect(plainError('context loop: re-read 18 files; stopped to save cost')).toMatch(/couldn't fix on its own/)
  })
  it('keeps ordinary errors readable', () => {
    expect(plainError('agent reported error: the site was down')).toBe('The site was down')
  })
  it('removes credit and cost wording from results', () => {
    const s = plainSummary('Done: 1 image generated with the cheapest option (Z Image, 0.15 credits; other at 0.75 credits was blocked). Saved to out/red-apple.png.')
    expect(s).not.toMatch(/credit/i)
    expect(s).toMatch(/^Done: 1 image generated/)
    expect(plainSummary('Finished the report. It cost $0.02 in usage.')).toBe('Finished the report.')
  })
})

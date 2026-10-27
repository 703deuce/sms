import { describe, expect, it } from 'vitest'
import { parseRecControlPayload, parseRecordingRoomMetadata, recControlMessageSchema } from '@/lib/recording/rec-control'

describe('rec-control', () => {
  it('parses start packet', () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({ t: 'start', takeId: 'rtake_abc12345', startAtHostMs: 1200 }),
    )
    expect(parseRecControlPayload(bytes)).toMatchObject({
      t: 'start',
      takeId: 'rtake_abc12345',
      startAtHostMs: 1200,
    })
  })

  it('rejects invalid packets', () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ type: 'nope' }))
    expect(parseRecControlPayload(bytes)).toBeNull()
  })

  it('parses room metadata', () => {
    expect(
      parseRecordingRoomMetadata(JSON.stringify({ v: 1, recState: 'recording', takeId: 't1', startAtHostMs: 5 })),
    ).toMatchObject({ recState: 'recording', takeId: 't1' })
  })

  it('validates stop schema', () => {
    const parsed = recControlMessageSchema.parse({
      type: 'stop',
      takeId: 'rtake_abc12345',
      stopAtHostMs: 9000,
    })
    expect('type' in parsed ? parsed.type : parsed.t).toBe('stop')
  })
})

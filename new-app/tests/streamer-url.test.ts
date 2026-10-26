import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseStreamUrl } from '@/lib/streamer/url'

const fixture = JSON.parse(
  readFileSync(join(__dirname, '../../worker/tests/fixtures/stream_urls.json'), 'utf8'),
) as { url: string; expect: Record<string, unknown> }[]

describe('streamer-url fixture parity', () => {
  it('matches worker fixture', () => {
    for (const row of fixture) {
      const got = parseStreamUrl(row.url)
      const exp = row.expect
      if (exp.error === true) {
        expect('error' in got).toBe(true)
      } else if (exp.error) {
        expect('error' in got && got.error).toBe(exp.error)
      } else {
        expect('error' in got).toBe(false)
        if (!('error' in got)) {
          for (const [k, v] of Object.entries(exp)) {
            expect((got as Record<string, unknown>)[k]).toBe(v)
          }
        }
      }
    }
  })
})

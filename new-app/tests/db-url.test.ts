import { describe, expect, it } from 'vitest'
import { resolvePrismaDatabaseUrl } from '@/lib/server/db'

describe('resolvePrismaDatabaseUrl', () => {
  it('adds pgbouncer and connection_limit for Supabase pooler host', () => {
    const out = resolvePrismaDatabaseUrl(
      'postgresql://user:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
    )
    const url = new URL(out)
    expect(url.searchParams.get('pgbouncer')).toBe('true')
    expect(url.searchParams.get('connection_limit')).toBe('3')
  })

  it('preserves an explicit connection_limit', () => {
    const out = resolvePrismaDatabaseUrl(
      'postgresql://user:pass@db.example.com:5432/postgres?connection_limit=7',
    )
    expect(new URL(out).searchParams.get('connection_limit')).toBe('7')
  })
})

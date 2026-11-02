import { describe, expect, it, afterEach } from 'vitest'
import { resolvePrismaDatabaseUrl } from '@/lib/server/db'

describe('resolvePrismaDatabaseUrl', () => {
  afterEach(() => {
    delete process.env.PRISMA_PGBOUNCER_MODE
  })

  it('adds pgbouncer and connection_limit for Supabase pooler host on 6543', () => {
    const out = resolvePrismaDatabaseUrl(
      'postgresql://user:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
    )
    const url = new URL(out)
    expect(url.searchParams.get('pgbouncer')).toBe('true')
    expect(url.searchParams.get('connection_limit')).toBe('3')
  })

  it('does not add pgbouncer on pooler host when port is 5432', () => {
    const out = resolvePrismaDatabaseUrl(
      'postgresql://user:pass@aws-0-us-east-1.pooler.supabase.com:5432/postgres',
    )
    const url = new URL(out)
    expect(url.searchParams.get('pgbouncer')).toBeNull()
    expect(url.searchParams.get('connection_limit')).toBe('3')
  })

  it('does not add pgbouncer when PRISMA_PGBOUNCER_MODE=off', () => {
    process.env.PRISMA_PGBOUNCER_MODE = 'off'
    const out = resolvePrismaDatabaseUrl(
      'postgresql://user:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
    )
    expect(new URL(out).searchParams.get('pgbouncer')).toBeNull()
  })

  it('preserves an explicit connection_limit', () => {
    const out = resolvePrismaDatabaseUrl(
      'postgresql://user:pass@db.example.com:5432/postgres?connection_limit=7',
    )
    expect(new URL(out).searchParams.get('connection_limit')).toBe('7')
  })
})

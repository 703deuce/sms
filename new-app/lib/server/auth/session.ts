import 'server-only'
import type { User } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { getPrisma } from '@/lib/server/db'
import { resolveInternalUserId } from '@/lib/server/internal-user'
import { createSupabaseServerClient } from '@/lib/server/supabase/server-client'
import { isSupabaseAuthConfigured } from '@/lib/server/supabase/env'

export type AppAuthUser = {
  id: string
  email: string | null
  supabaseUser: User | null
}

/** Resolved Prisma user id from Supabase session, or dev internal user when auth is not configured. */
export async function getAuthenticatedUserId(request?: NextRequest | Request): Promise<string | null> {
  const user = await getAuthenticatedUser(request)
  return user?.id ?? null
}

export async function getAuthenticatedUser(request?: NextRequest | Request): Promise<AppAuthUser | null> {
  if (!isSupabaseAuthConfigured()) {
    if (process.env.DEV_AUTH_BYPASS === '1') {
      const id = await resolveInternalUserId()
      const prisma = getPrisma()
      const row = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true } })
      if (row) return { id: row.id, email: row.email, supabaseUser: null }
    }
    return null
  }

  const supabase = await createSupabaseServerClient(request)
  if (!supabase) return null

  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null

  const prisma = getPrisma()
  const row = await prisma.user.findUnique({
    where: { id: data.user.id },
    select: { id: true, email: true },
  })
  if (!row) {
    const email = data.user.email?.trim().toLowerCase()
    if (email) {
      const byEmail = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } })
      if (byEmail) return { id: byEmail.id, email: byEmail.email, supabaseUser: data.user }
    }
    return null
  }

  return { id: row.id, email: row.email, supabaseUser: data.user }
}

export async function requireAuthenticatedUser(request?: NextRequest | Request): Promise<AppAuthUser> {
  const user = await getAuthenticatedUser(request)
  if (!user) throw new AuthRequiredError()
  return user
}

export class AuthRequiredError extends Error {
  readonly status = 401
  constructor() {
    super('Authentication required')
    this.name = 'AuthRequiredError'
  }
}

export class ForbiddenError extends Error {
  readonly status = 403
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

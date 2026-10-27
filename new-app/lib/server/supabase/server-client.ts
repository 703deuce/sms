import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { getSupabaseAnonConfig } from '@/lib/server/supabase/env'

type CookieMethods = {
  getAll: () => { name: string; value: string }[]
  setAll: (cookies: { name: string; value: string; options?: Record<string, unknown> }[]) => void
}

function cookieMethodsFromStore(store: Awaited<ReturnType<typeof cookies>>): CookieMethods {
  return {
    getAll() {
      return store.getAll()
    },
    setAll(cookiesToSet) {
      try {
        for (const { name, value, options } of cookiesToSet) {
          store.set(name, value, options)
        }
      } catch {
        // Called from a Server Component — cookie writes may be ignored.
      }
    },
  }
}

function cookieMethodsFromRequest(request: NextRequest | Request): CookieMethods {
  const header = request.headers.get('cookie') ?? ''
  const parsed = header
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const eq = part.indexOf('=')
      if (eq < 0) return { name: part, value: '' }
      return { name: part.slice(0, eq), value: decodeURIComponent(part.slice(eq + 1)) }
    })

  return {
    getAll() {
      return parsed
    },
    setAll() {
      // Route handlers set cookies on the response separately when needed.
    },
  }
}

export async function createSupabaseServerClient(request?: NextRequest | Request) {
  const cfg = getSupabaseAnonConfig()
  if (!cfg) return null

  const cookieStore = request ? cookieMethodsFromRequest(request) : cookieMethodsFromStore(await cookies())

  return createServerClient(cfg.url, cfg.anonKey, { cookies: cookieStore })
}

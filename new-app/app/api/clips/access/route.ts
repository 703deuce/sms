import { NextResponse } from 'next/server'
import { z } from 'zod'
import { timingSafeEqual } from 'node:crypto'
import { clipsAccessTokenFromPassword } from '@/lib/clips-access-cookie'
import { CLIPS_ACCESS_COOKIE } from '@/lib/clips-access-constants'
import { jsonError } from '@/lib/server/api-error'

const bodySchema = z.object({
  password: z.string().min(1).max(500),
})

function safeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a)
    const bb = Buffer.from(b)
    return ba.length === bb.length && timingSafeEqual(ba, bb)
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  try {
    const expected = process.env.CLIPS_ACCESS_PASSWORD?.trim()
    if (!expected) {
      return NextResponse.json({ error: 'Clips access gate is not configured' }, { status: 503 })
    }
    const body = bodySchema.parse(await request.json())
    if (!safeEqual(body.password, expected)) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }
    const token = clipsAccessTokenFromPassword(expected)
    const res = NextResponse.json({ data: { ok: true } })
    res.cookies.set(CLIPS_ACCESS_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
    return res
  } catch (err) {
    return jsonError(err, 400)
  }
}

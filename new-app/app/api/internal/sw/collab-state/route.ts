import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/server/db'
import { timingSafeEqual, createHmac } from 'node:crypto'

function verifyInternal(request: Request): boolean {
  const secret = process.env.SW_COLLAB_SECRET || process.env.INTERNAL_JOB_HMAC_SECRET || ''
  if (!secret) return false
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return false
  const expected = createHmac('sha256', secret).update('sw-collab-internal').digest('hex')
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  } catch {
    return false
  }
}

export async function GET(request: Request) {
  if (!verifyInternal(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const scriptId = new URL(request.url).searchParams.get('scriptId')
  if (!scriptId) return NextResponse.json({ error: 'scriptId required' }, { status: 400 })
  const prisma = getPrisma()
  const row = await prisma.swScript.findUnique({ where: { id: scriptId }, select: { yState: true } })
  if (!row?.yState?.length) return new NextResponse(null, { status: 204 })
  return new NextResponse(row.yState, {
    status: 200,
    headers: { 'Content-Type': 'application/octet-stream' },
  })
}

export async function POST(request: Request) {
  if (!verifyInternal(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const scriptId = request.headers.get('x-sw-script-id')
  if (!scriptId) return NextResponse.json({ error: 'x-sw-script-id required' }, { status: 400 })
  const buf = Buffer.from(await request.arrayBuffer())
  const prisma = getPrisma()
  await prisma.swScript.update({
    where: { id: scriptId },
    data: { yState: buf, updatedAt: new Date() },
  })
  return NextResponse.json({ ok: true })
}

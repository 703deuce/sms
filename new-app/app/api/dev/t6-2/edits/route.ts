import { NextResponse } from 'next/server'

let store: Record<string, unknown> = {}

export async function PATCH(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  const body = await req.json()
  store = { ...store, ...body }
  return NextResponse.json({ ok: true, store })
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  return NextResponse.json({ store })
}

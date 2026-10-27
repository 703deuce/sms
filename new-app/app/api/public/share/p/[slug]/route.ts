import { NextResponse } from 'next/server'
import { getPublicPublishPayload } from '@/lib/server/clips/composition-share-public'

export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const payload = await getPublicPublishPayload(slug)
  if (!payload) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ data: payload })
}

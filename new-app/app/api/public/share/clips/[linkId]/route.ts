import { NextResponse } from 'next/server'
import { getPublicShareClipPayload } from '@/lib/server/clips/composition-share-public'

export async function GET(_request: Request, ctx: { params: Promise<{ linkId: string }> }) {
  const { linkId } = await ctx.params
  const payload = await getPublicShareClipPayload(linkId)
  if (!payload) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ data: payload })
}

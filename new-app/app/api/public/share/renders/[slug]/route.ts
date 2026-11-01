import { NextResponse } from 'next/server'
import { getPublicRenderSharePayload } from '@/lib/server/clips/render-share'

export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const payload = await getPublicRenderSharePayload(slug, request)
  if (!payload) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ data: payload })
}

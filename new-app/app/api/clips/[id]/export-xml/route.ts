import { NextResponse } from 'next/server'

/** Legacy path (pre #931): redirect to canonical /api/clips/clips/[id]/export-xml */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const url = new URL(request.url)
  url.pathname = `/api/clips/clips/${id}/export-xml`
  return NextResponse.redirect(url, 308)
}

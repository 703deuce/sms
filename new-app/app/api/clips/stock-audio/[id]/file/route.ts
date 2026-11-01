import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { ensureStockAudioFile } from '@/lib/server/ai/stock-audio'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await resolveWorkspaceId()
    const { id } = await ctx.params
    const url = await ensureStockAudioFile(id)
    return NextResponse.redirect(url, 302)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Unknown')) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return jsonError(err, 500)
  }
}

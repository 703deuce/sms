import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const bodySchema = z.object({
  panel: z.string().max(120).optional(),
  message: z.string().max(2000),
  stack: z.string().max(8000).optional(),
  componentStack: z.string().max(8000).optional(),
  href: z.string().max(2000).optional(),
})

/** Lightweight client error reports from the clip editor (diagnostics only). */
export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = bodySchema.parse(await request.json())
    console.error('[clip-editor-client-error]', {
      workspaceId,
      panel: body.panel,
      message: body.message,
      href: body.href,
      stack: body.stack,
      componentStack: body.componentStack,
    })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return jsonError(err, 400)
  }
}

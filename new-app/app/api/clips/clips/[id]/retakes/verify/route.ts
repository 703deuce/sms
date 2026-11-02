import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  discoverVisionFlashLiteModel,
  geminiGenerateJson,
  geminiVisionConfigured,
} from '@/lib/server/ai/gemini-flash-lite'
import { jsonError } from '@/lib/server/api-error'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const bodySchema = z.object({
  groups: z
    .array(
      z.object({
        attempts: z.array(z.string().trim().min(1).max(400)).min(2).max(10),
      }),
    )
    .max(30),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = bodySchema.parse(await request.json())
    if (!geminiVisionConfigured()) {
      return NextResponse.json({ data: { confirmed: null } })
    }

    try {
      const model = await discoverVisionFlashLiteModel()
      const lines = body.groups
        .map((g, i) => `${i + 1}. ${g.attempts.map((a, j) => `[${j + 1}] ${a.slice(0, 400)}`).join(' | ')}`)
        .join('\n')
      const { text } = await geminiGenerateJson({
        model,
        timeoutMs: 15_000,
        parts: [
          {
            text: `You verify repeated spoken takes (retakes). For each numbered group, decide if the attempts are the same idea repeated (retake). Return JSON {"confirmed": boolean[]} with one boolean per group in order.\n${lines}`,
          },
        ],
        responseSchema: {
          type: 'object',
          properties: {
            confirmed: { type: 'array', items: { type: 'boolean' } },
          },
          required: ['confirmed'],
        },
      })
      const parsed = JSON.parse(text) as { confirmed?: boolean[] }
      const confirmed = (parsed.confirmed ?? []).slice(0, body.groups.length)
      if (confirmed.length !== body.groups.length) {
        return NextResponse.json({ data: { confirmed: null } })
      }
      return NextResponse.json({ data: { confirmed } })
    } catch {
      return NextResponse.json({ data: { confirmed: null } })
    }
  } catch (err) {
    return jsonError(err, 400)
  }
}

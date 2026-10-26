import { NextResponse } from 'next/server'
import { z } from 'zod'
import { applyProducerTools, type ProducerToolCall } from '@/lib/clips/edits-reducer'
import { normalizeEdits } from '@/lib/clips/edits'
import { jsonError } from '@/lib/server/api-error'
import { openAiJsonResponse } from '@/lib/server/ai/openai-json'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { createId } from '@/lib/supabase/id'

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
})

const SYSTEM = `You are the Clips AI Producer. Return JSON: { "reply": string, "tools": [{ "name": string, "args": object }] }.
Allowed tools: trim, set_captions, set_layout, set_title, set_music_mix, add_sfx, remove_broll, insert_stock_broll, generate_ai_broll, generate_music, generate_thumbnail.
Paid tools (generate_*) need user confirmation — only include them when the user clearly asks.
Keep edits minimal; one line per change in reply.`

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = bodySchema.parse(await request.json())
    const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
    const edits = normalizeEdits(clip.edits, bounds)

    const llm = await openAiJsonResponse<{ reply: string; tools: ProducerToolCall[] }>(
      SYSTEM,
      JSON.stringify({ userMessage: body.message, edits }),
    )

    const applied = applyProducerTools(edits, bounds, llm.tools || [])
    const prisma = getPrisma()
    let thread = await prisma.producerThread.findUnique({ where: { clipId } })
    if (!thread) {
      thread = await prisma.producerThread.create({
        data: { id: createId('pth'), clipId, workspaceId },
      })
    }
    await prisma.producerMessage.createMany({
      data: [
        { id: createId('pmsg'), threadId: thread.id, role: 'user', content: body.message },
        {
          id: createId('pmsg'),
          threadId: thread.id,
          role: 'assistant',
          content: llm.reply,
          toolCalls: llm.tools || [],
        },
      ],
    })

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        }
        send('message', { role: 'assistant', content: llm.reply })
        send('tools', { summaries: applied.summaries, pendingPaid: applied.pendingPaid })
        send('edits', { edits: applied.edits })
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    return jsonError(err, 400)
  }
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const prisma = getPrisma()
    const thread = await prisma.producerThread.findFirst({
      where: { clipId, workspaceId },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 50 } },
    })
    return NextResponse.json({ data: { thread } })
  } catch (err) {
    return jsonError(err, 500)
  }
}

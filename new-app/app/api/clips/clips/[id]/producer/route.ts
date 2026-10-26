import { z } from 'zod'
import { applyProducerTools, type ProducerToolCall } from '@/lib/clips/edits-reducer'
import { normalizeEdits } from '@/lib/clips/edits'
import { jsonError } from '@/lib/server/api-error'
import { openAiJsonResponse } from '@/lib/server/ai/openai-json'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { createId } from '@/lib/supabase/id'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
})

const SYSTEM = `You are the Clips AI Producer. Return JSON: { "reply": string, "tools": [{ "name": string, "args": object }] }.
Allowed tools: trim, set_captions, set_layout, set_title, set_music_mix, add_sfx, remove_broll, insert_stock_broll, generate_ai_broll, generate_music, generate_thumbnail, dub, apply_brand.
Paid tools (generate_*, dub) need user confirmation — only include them when the user clearly asks.
apply_brand applies the workspace brand template fields from args (logo/caption preset).
For caption changes, prefer ONE set_captions call with all fields (presetId, animation, size, etc.) instead of multiple calls.
Keep edits minimal; one line per change in reply.`

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  let clipId = ''
  let workspaceId = ''
  let userMessage = ''
  try {
    const params = await ctx.params
    clipId = params.id
    workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return jsonError(new Error('Not found'), 404)
    userMessage = bodySchema.parse(await request.json()).message
  } catch (err) {
    return jsonError(err, 400)
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }
      const ping = () => {
        controller.enqueue(encoder.encode(`: ping\n\n`))
      }
      ping()
      const pingIv = setInterval(ping, 10_000)
      try {
        const clip = await getClipForWorkspace(workspaceId, clipId)
        if (!clip) {
          send('error', { message: 'Not found' })
          return
        }
        const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
        const edits = normalizeEdits(clip.edits, bounds)

        const llm = await openAiJsonResponse<{ reply: string; tools: ProducerToolCall[] }>(
          SYSTEM,
          JSON.stringify({ userMessage, edits }),
        )

        const tools = llm.tools || []
        const prismaForBrand = getPrisma()
        const brandTpl = await prismaForBrand.clipBrandTemplate.findFirst({
          where: { workspaceId, isDefault: true },
        })
        const enrichedTools = tools.map((t) => {
          if (t.name !== 'apply_brand' || !brandTpl) return t
          return {
            ...t,
            args: {
              logoKey: brandTpl.logoKey,
              settings: brandTpl.settings,
              ...(t.args || {}),
            },
          }
        })
        const applied = applyProducerTools(edits, bounds, enrichedTools)

        for (const tool of applied.pendingPaid) {
          send('confirm', { tool })
        }

        send('message', { role: 'assistant', content: llm.reply })
        send('tools', { summaries: applied.summaries, pendingPaid: applied.pendingPaid })
        const changeCount = applied.summaries.filter((s) => !/^Pending /.test(s)).length
        send('edits', { edits: applied.edits, changeCount })

        const prisma = getPrisma()
        let thread = await prisma.producerThread.findUnique({ where: { clipId } })
        if (!thread) {
          thread = await prisma.producerThread.create({
            data: { id: createId('pth'), clipId, workspaceId },
          })
        }
        await prisma.producerMessage.createMany({
          data: [
            { id: createId('pmsg'), threadId: thread.id, role: 'user', content: userMessage },
            {
              id: createId('pmsg'),
              threadId: thread.id,
              role: 'assistant',
              content: llm.reply,
              toolCalls: llm.tools || [],
            },
          ],
        })
      } catch (err) {
        send('error', { message: err instanceof Error ? err.message : 'Producer failed' })
      } finally {
        clearInterval(pingIv)
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
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
    return Response.json({ data: { thread } })
  } catch (err) {
    return jsonError(err, 500)
  }
}

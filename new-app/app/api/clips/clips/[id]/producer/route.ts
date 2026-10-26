import { z } from 'zod'
import type { ProducerToolCall } from '@/lib/clips/edits-reducer'
import { normalizeEdits } from '@/lib/clips/edits'
import { jsonError } from '@/lib/server/api-error'
import { openAiJsonResponse } from '@/lib/server/ai/openai-json'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { loadClipWords, PRODUCER_SYSTEM_CLIP, runProducerOnClip } from '@/lib/server/clips/producer-run'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { createId } from '@/lib/supabase/id'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
})

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
          PRODUCER_SYSTEM_CLIP,
          JSON.stringify({ userMessage, edits }),
        )

        const tools = llm.tools || []
        const PAID_TOOLS = new Set([
          'generate_ai_broll',
          'generate_music',
          'generate_thumbnail',
          'dub',
        ])
        // Emit paid-tool confirm cards before any other work (no music suggest / DB here).
        for (const t of tools) {
          if (PAID_TOOLS.has(t.name)) {
            send('confirm', { tool: { ...t, requiresConfirm: true } })
          }
        }

        const prismaForBrand = getPrisma()
        const brandTpl = await prismaForBrand.clipBrandTemplate.findFirst({
          where: { workspaceId, isDefault: true },
        })
        const enrichedTools = tools.map((t) => {
          if (t.name !== 'apply_brand' || !brandTpl) return t
          return {
            ...t,
            args: {
              templateId: brandTpl.id,
              logoKey: brandTpl.logoKey,
              introVideoKey: brandTpl.introVideoKey,
              outroVideoKey: brandTpl.outroVideoKey,
              settings: brandTpl.settings,
              ...(t.args || {}),
            },
          }
        })
        const prismaWords = getPrisma()
        const project = await prismaWords.clipProject.findUnique({ where: { id: clip.projectId } })
        const words = await loadClipWords(workspaceId, clip.projectId, clipId, project?.transcriptWords)
        const applied = runProducerOnClip(edits, bounds, enrichedTools, words, llm.reply)

        send('message', { role: 'assistant', content: applied.reply ?? llm.reply })
        send('tools', { summaries: applied.summaries, pendingPaid: applied.pendingPaid })
        send('edits', { edits: applied.edits, changeCount: applied.changeCount })

        const prisma = getPrisma()
        if (applied.changeCount > 0) {
          await prisma.clip.update({
            where: { id: clipId },
            data: { edits: applied.edits as object },
          })
        }
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

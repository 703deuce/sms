import { z } from 'zod'
import type { ProducerToolCall } from '@/lib/clips/edits-reducer'
import { jsonError } from '@/lib/server/api-error'
import { openAiJsonResponse } from '@/lib/server/ai/openai-json'
import { applyProjectProducerActions } from '@/lib/server/clips/project-producer'
import { PRODUCER_SYSTEM_PROJECT } from '@/lib/server/clips/producer-run'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { createId } from '@/lib/supabase/id'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
})

type LlmProjectResponse = {
  reply: string
  actions?: { clipId: string; tools: ProducerToolCall[] }[]
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  let projectId = ''
  let workspaceId = ''
  let userMessage = ''
  try {
    const params = await ctx.params
    projectId = params.id
    workspaceId = await resolveWorkspaceId()
    const prisma = getPrisma()
    const project = await prisma.clipProject.findFirst({ where: { id: projectId, workspaceId } })
    if (!project) return jsonError(new Error('Not found'), 404)
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
      const ping = () => controller.enqueue(encoder.encode(`: ping\n\n`))
      ping()
      const pingIv = setInterval(ping, 10_000)
      try {
        const prisma = getPrisma()
        const project = await prisma.clipProject.findFirst({ where: { id: projectId, workspaceId } })
        if (!project) {
          send('error', { message: 'Not found' })
          return
        }
        const clips = await prisma.clip.findMany({
          where: { projectId, workspaceId, deletedAt: null },
          orderBy: { score: 'desc' },
          take: 12,
        })
        const catalog = clips.map((c) => ({
          clipId: c.id,
          title: c.title,
          startMs: c.startMs,
          endMs: c.endMs,
          score: c.score,
        }))

        const llm = await openAiJsonResponse<LlmProjectResponse>(
          PRODUCER_SYSTEM_PROJECT,
          JSON.stringify({ userMessage, clips: catalog }),
        )

        const actions = (llm.actions || []).filter((a) => a.clipId && a.tools?.length)
        const brandTpl = await prisma.clipBrandTemplate.findFirst({
          where: { workspaceId, isDefault: true },
        })
        const enrichedActions = actions.map((a) => ({
          clipId: a.clipId,
          tools: a.tools.map((t) => {
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
          }),
        }))

        const results = await applyProjectProducerActions(
          workspaceId,
          projectId,
          enrichedActions,
          project.transcriptWords,
        )

        send('message', { role: 'assistant', content: llm.reply })
        send('batch', {
          clips: results.map((r) => ({
            clipId: r.clipId,
            title: r.title,
            changeCount: r.changeCount,
            summaries: r.summaries,
            before: r.before,
            after: r.after,
          })),
        })

        let thread = await prisma.producerThread.findFirst({ where: { projectId, workspaceId } })
        if (!thread) {
          thread = await prisma.producerThread.create({
            data: { id: createId('pth'), projectId, workspaceId },
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
              toolCalls: enrichedActions as object,
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
    const { id: projectId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const prisma = getPrisma()
    const thread = await prisma.producerThread.findFirst({
      where: { projectId, workspaceId },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 50 } },
    })
    return Response.json({ data: { thread } })
  } catch (err) {
    return jsonError(err, 500)
  }
}

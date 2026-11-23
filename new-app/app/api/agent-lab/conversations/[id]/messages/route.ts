import { agentLabErrorResponse, agentLabJson, attachmentNote, isConversationId, readMessageRequest, saveAttachments, userMessage } from '@/lib/server/agent-lab'

export const dynamic = 'force-dynamic'

/** Send Rick's message (JSON `{message}` or multipart with `message` + `files`) to a conversation. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    if (!isConversationId(id)) return Response.json({ error: 'Invalid conversation id' }, { status: 400 })
    const { message: text, files } = await readMessageRequest(request)
    if (!text && !files.length) return Response.json({ error: 'Message is required' }, { status: 400 })
    const saved = files.length ? await saveAttachments(id, files) : []
    const message = (text || 'Please look at the attached files.') + attachmentNote(saved)
    await agentLabJson(`/api/conversations/${encodeURIComponent(id)}/events`, {
      method: 'POST',
      body: JSON.stringify(userMessage(message)),
    })
    return Response.json({ ok: true, attachments: saved })
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}

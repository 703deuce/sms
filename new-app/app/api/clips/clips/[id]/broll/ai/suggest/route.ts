import { NextResponse } from 'next/server'
import { buildCaptionWords } from '@/lib/clips/caption-words'
import { normalizeEdits } from '@/lib/clips/edits'
import { loadSourceWords } from '@/lib/clips/source-words'
import { openAiJsonResponse } from '@/lib/server/ai/openai-json'
import { jsonError } from '@/lib/server/api-error'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const SYSTEM = `You suggest vertical B-roll shots for a short social clip. Return JSON {"suggestions":[{"atMs":number,"durationS":number,"prompt":string}]} with 1-3 items.
Rules: cinematic stock-style shot; vertical 9:16 framing; no real people's names or logos; no text overlays; each prompt is under 60 words with concrete subject, action, setting, and lighting. durationS must be 3-5.`

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const prisma = getPrisma()
    const project = await prisma.clipProject.findUnique({ where: { id: clip.projectId } })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
    const edits = normalizeEdits(clip.edits, bounds)
    const storage = getClipStorage()
    let transcript: { w: string; s: number; e: number }[] = []
    if (project.transcriptKey) {
      try {
        transcript = await storage.getJson<{ w: string; s: number; e: number }[]>(project.transcriptKey)
      } catch {
        transcript = []
      }
    }
    const words = loadSourceWords(transcript)
    const capped = buildCaptionWords(words, edits).map((w) => w.text).join(' ')

    const result = await openAiJsonResponse<{ suggestions: { atMs: number; durationS: number; prompt: string }[] }>(
      SYSTEM,
      `Clip transcript:\n${capped.slice(0, 8000)}`,
    )
    const suggestions = (result.suggestions || []).slice(0, 3).map((s) => ({
      atMs: Math.max(0, Math.round(s.atMs)),
      durationS: Math.min(5, Math.max(3, Math.round(s.durationS))),
      prompt: String(s.prompt || '').slice(0, 500),
    }))
    return NextResponse.json({ data: { suggestions } })
  } catch (err) {
    return jsonError(err, 500)
  }
}

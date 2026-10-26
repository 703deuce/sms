import { NextResponse } from 'next/server'
import { buildCaptionWords } from '@/lib/clips/caption-words'
import { stripArtistSongNames } from '@/lib/clips/audio'
import { normalizeEdits } from '@/lib/clips/edits'
import { loadSourceWords } from '@/lib/clips/source-words'
import { openAiJsonResponse } from '@/lib/server/ai/openai-json'
import { jsonError } from '@/lib/server/api-error'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const SYSTEM = `You suggest instrumental background music for a short social video clip.
Return JSON {"prompt":string,"mood":string,"bpmHint":number}.
Rules: no artist, song or label names; describe genre, instruments, energy and tempo only; keep prompt under 80 words; instrumental only.`

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
        transcript = await storage.getJson(project.transcriptKey)
      } catch {
        transcript = []
      }
    }
    const words = loadSourceWords(transcript)
    const capped = buildCaptionWords(words, edits).map((w) => w.text).join(' ')
    const aiMeta = (clip.aiMeta || {}) as { mood?: string; scoring?: { mood?: string } }
    const scores = (clip.scores || {}) as { mood?: string }
    const mood = scores.mood || aiMeta.mood || aiMeta.scoring?.mood || 'neutral'

    const result = await openAiJsonResponse<{ prompt: string; mood: string; bpmHint: number }>(
      SYSTEM,
      `Clip mood: ${mood}\nTranscript:\n${capped.slice(0, 8000)}`,
    )
    const prompt = stripArtistSongNames(String(result.prompt || '').slice(0, 500))
    return NextResponse.json({
      data: {
        prompt,
        mood: String(result.mood || mood),
        bpmHint: Number(result.bpmHint) || 90,
      },
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}

import 'server-only'

import {
  EXPORT_HEADLINE_MAX_REGENERATIONS,
  formatHeadlineForExport,
  type ClipExportTemplate,
} from '@/lib/clips/export-template'
import { getClipsLlmModelId } from '@/lib/server/ai/clips-llm'
import { gpt6ChatCompletionExtras, isGpt6FamilyModel } from '@/lib/server/ai/gpt-6-luna-chat'
import { recordAiUsage } from '@/lib/server/clips/ai-usage'
import { getPrisma } from '@/lib/server/db'
import { loadClipSourceWords } from '@/lib/server/clips/transcript'
import { normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { mergeEditsPatch } from '@/lib/server/clips/clip-detail'

const LUNA_INPUT_MICROS_PER_TOKEN = 100_000
const LUNA_OUTPUT_MICROS_PER_TOKEN = 500_000

function lunaCost(prompt: number, completion: number) {
  return Math.round(prompt * LUNA_INPUT_MICROS_PER_TOKEN + completion * LUNA_OUTPUT_MICROS_PER_TOKEN)
}

async function loadChatSnippet(
  projectId: string,
  startMs: number,
  endMs: number,
): Promise<string> {
  const prisma = getPrisma()
  const vod = await prisma.streamVod.findFirst({ where: { projectId } })
  if (!vod?.chatMessages || vod.chatMessages < 1) return ''
  const state = (vod.state && typeof vod.state === 'object' ? vod.state : {}) as Record<string, unknown>
  const chatKey = state.chatKey as string | undefined
  if (!chatKey) return ''
  try {
    const { getClipStorage } = await import('@/lib/storage')
    const storage = getClipStorage()
    const url = await storage.createSignedDownloadUrl(chatKey, 300)
    const res = await fetch(url)
    if (!res.ok) return ''
    const buf = Buffer.from(await res.arrayBuffer())
    const zlib = await import('zlib')
    const text = zlib.gunzipSync(buf).toString('utf8')
    const lines = text.split('\n').filter(Boolean).slice(0, 5000)
    const out: string[] = []
    for (const line of lines) {
      try {
        const row = JSON.parse(line) as { t?: number; user?: string; text?: string; message?: string }
        const t = Number(row.t ?? 0)
        if (t < startMs - 15_000 || t > endMs + 5000) continue
        const msg = String(row.text ?? row.message ?? '').trim()
        if (!msg) continue
        out.push(`${row.user || 'chat'}: ${msg.slice(0, 120)}`)
        if (out.length >= 24) break
      } catch {
        continue
      }
    }
    return out.join('\n')
  } catch {
    return ''
  }
}

export async function generateExportHeadline(opts: {
  workspaceId: string
  clipId: string
  projectId: string
  title: string
  startMs: number
  endMs: number
  edits: ClipEditsV2
}): Promise<{ headline: string; generations: number; exportTemplate: ClipExportTemplate }> {
  const tpl = (opts.edits.exportTemplate || {}) as ClipExportTemplate
  const used = tpl.headlineGenerations ?? 0
  if (used >= EXPORT_HEADLINE_MAX_REGENERATIONS) {
    throw new Error(`Headline limit reached (${EXPORT_HEADLINE_MAX_REGENERATIONS} per clip)`)
  }

  const clipRow = await getPrisma().clip.findUniqueOrThrow({
    where: { id: opts.clipId },
    select: { wordsKey: true, projectId: true, startMs: true },
  })
  const words = await loadClipSourceWords({
    projectId: clipRow.projectId,
    startMs: clipRow.startMs,
    wordsKey: clipRow.wordsKey,
  })
  const startS = opts.startMs / 1000
  const endS = opts.endMs / 1000
  const slice = words.filter((w) => w.s >= startS && w.s < endS)
  const transcript = slice.map((w) => w.w).join(' ').trim().slice(0, 4000)
  if (!transcript) throw new Error('No transcript for headline generation')

  const chat = await loadChatSnippet(opts.projectId, opts.startMs, opts.endMs)

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
  const model = getClipsLlmModelId()
  const system =
    'Write one short stream clip headline (max 8 words, ALL CAPS style, max 40 characters before emoji). ' +
    'Punchy, specific, end with 1-2 emoji. JSON only: {"headline":"..."}'
  const user = `Title: ${opts.title}\nTranscript:\n${transcript}\n${chat ? `Chat highlights:\n${chat}` : ''}`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens: isGpt6FamilyModel(model) ? 120 : 80,
      ...gpt6ChatCompletionExtras(model),
    }),
    signal: AbortSignal.timeout(45_000),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}`)
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  const content = json.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty LLM response')
  const parsed = JSON.parse(content) as { headline?: string }
  const headline = formatHeadlineForExport(String(parsed.headline || '').trim())
  if (!headline) throw new Error('Model returned empty headline')

  const promptTokens = json.usage?.prompt_tokens ?? 0
  const completionTokens = json.usage?.completion_tokens ?? 0
  await recordAiUsage({
    workspaceId: opts.workspaceId,
    clipId: opts.clipId,
    projectId: opts.projectId,
    usage: {
      provider: 'openai',
      model,
      units: promptTokens + completionTokens,
      unitType: 'tokens',
      costUsdMicros: lunaCost(promptTokens, completionTokens),
    },
  })

  const nextGen = used + 1
  const exportTemplate: ClipExportTemplate = {
    ...tpl,
    headlineBar: { enabled: tpl.headlineBar?.enabled ?? true, text: headline },
    suggestedHeadline: headline,
    headlineGenerations: nextGen,
  }

  return { headline, generations: nextGen, exportTemplate }
}

export async function persistExportTemplate(
  clipId: string,
  bounds: { clipStartMs: number; clipEndMs: number },
  patch: Partial<ClipExportTemplate>,
  currentEdits: unknown,
) {
  const prisma = getPrisma()
  const base = normalizeEdits(currentEdits, bounds)
  const merged = mergeEditsPatch(
    base,
    { exportTemplate: { ...(base.exportTemplate || {}), ...patch } },
    bounds,
  )
  const edits = normalizeEdits(merged, bounds)
  await prisma.clip.update({ where: { id: clipId }, data: { edits } })
  return edits
}

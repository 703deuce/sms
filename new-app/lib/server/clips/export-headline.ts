import 'server-only'

import {
  EXPORT_HEADLINE_MAX_REGENERATIONS,
  channelUrlFromVodUrl,
  formatHeadlineForExport,
  isPlaceholderChannelUrl,
  normalizeChannelUrl,
  type ClipExportTemplate,
} from '@/lib/clips/export-template'
import {
  clipsEditorJsonWithGeminiFallback,
  clipsEditorLlmCostMicros,
} from '@/lib/server/ai/clips-editor-llm'
import { recordAiUsage } from '@/lib/server/clips/ai-usage'
import { getPrisma } from '@/lib/server/db'
import { loadClipSourceWords } from '@/lib/server/clips/transcript'
import { normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { mergeEditsPatch } from '@/lib/server/clips/clip-detail'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'

export type StreamExportTemplateContext = {
  platform?: 'twitch' | 'kick'
  channelUrl?: string | null
}

export async function loadStreamExportTemplateContext(projectId: string): Promise<StreamExportTemplateContext> {
  const vod = await getPrisma().streamVod.findFirst({
    where: { projectId },
    select: {
      platform: true,
      url: true,
      channel: { select: { login: true, platform: true } },
    },
  })
  if (!vod) return {}
  const platformRaw = (vod.platform || vod.channel?.platform || '').toLowerCase()
  const platform = platformRaw === 'kick' || platformRaw === 'twitch' ? platformRaw : undefined
  const fromVod = vod.url ? channelUrlFromVodUrl(vod.url) : null
  const slug = vod.channel?.login
  const fromSlug =
    platform && slug
      ? normalizeChannelUrl(platform === 'kick' ? `https://kick.com/${slug}` : `https://twitch.tv/${slug}`)
      : null
  return { platform, channelUrl: fromVod || fromSlug }
}

/** Fill platform / badge / channel defaults for stream export template (export-only overlays). */
export function mergeStreamExportTemplate(
  tpl: ClipExportTemplate,
  ctx: StreamExportTemplateContext,
  opts?: { defaultChannelUrl?: string | null },
): ClipExportTemplate {
  const platform = tpl.platform ?? ctx.platform
  const rawUrl = tpl.channelLink?.url || opts?.defaultChannelUrl || ctx.channelUrl || ''
  const channelUrl = normalizeChannelUrl(rawUrl) || undefined
  const channelEnabled =
    Boolean(tpl.channelLink?.enabled) && Boolean(channelUrl) && !isPlaceholderChannelUrl(channelUrl)
  return {
    ...tpl,
    platform,
    platformBadge: tpl.platformBadge ?? { enabled: false },
    channelLink: {
      enabled: channelEnabled,
      url: channelEnabled ? channelUrl : undefined,
    },
  }
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
  aiMeta?: Record<string, unknown> | null
}): Promise<{ headline: string; generations: number; exportTemplate: ClipExportTemplate }> {
  const streamCtx = await loadStreamExportTemplateContext(opts.projectId)
  const tpl = mergeStreamExportTemplate((opts.edits.exportTemplate || {}) as ClipExportTemplate, streamCtx)
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

  const streamer = (opts.aiMeta as { streamer?: { displayName?: string; login?: string } } | null)?.streamer
  const streamerName = streamer?.displayName || streamer?.login || 'the streamer'
  const system =
    'Write a viral stream-clip headline: plain English, ALL CAPS, 2-3 short lines when read aloud (max ~70 chars before emoji). ' +
    'State what happened — punchy and factual using ONLY transcript/chat facts. No invented claims or drama. ' +
    `Use the streamer's name (${streamerName}) when natural. End with 1-2 relevant emoji. JSON only: {"headline":"..."}`
  const user = `Streamer: ${streamerName}\nClip title: ${opts.title}\nTranscript:\n${transcript}\n${chat ? `Chat highlights:\n${chat}` : ''}`

  const llm = await clipsEditorJsonWithGeminiFallback<{ headline?: string }>({
    context: 'export_headline',
    system,
    user,
    maxOutputTokens: 120,
    responseSchema: {
      type: 'object',
      properties: { headline: { type: 'string' } },
      required: ['headline'],
    },
  })
  const headline = formatHeadlineForExport(String(llm.data.headline || '').trim())
  if (!headline) throw new Error('Model returned empty headline')

  const costUsdMicros = clipsEditorLlmCostMicros(llm.provider, llm.promptTokens, llm.completionTokens)
  await recordAiUsage({
    workspaceId: opts.workspaceId,
    clipId: opts.clipId,
    projectId: opts.projectId,
    usage: {
      provider: llm.provider,
      model: llm.model,
      units: llm.promptTokens + llm.completionTokens,
      unitType: 'tokens',
      costUsdMicros,
    },
  })

  const nextGen = used + 1
  const exportTemplate: ClipExportTemplate = mergeStreamExportTemplate(
    {
      ...tpl,
      headlineBar: { enabled: true, text: headline },
      suggestedHeadline: headline,
      headlineGenerations: nextGen,
    },
    streamCtx,
  )

  return { headline, generations: nextGen, exportTemplate }
}

/** Persist export template patch and return normalized edits (generate / toggles / prefetch). */
export async function persistExportTemplatePatch(
  clipId: string,
  bounds: { clipStartMs: number; clipEndMs: number },
  patch: Partial<ClipExportTemplate>,
  currentEdits: unknown,
  projectId?: string,
) {
  const ctx = projectId ? await loadStreamExportTemplateContext(projectId) : {}
  const base = normalizeEdits(currentEdits, bounds)
  const mergedTpl = mergeStreamExportTemplate(
    { ...(base.exportTemplate || {}), ...patch } as ClipExportTemplate,
    ctx,
  )
  return persistExportTemplate(clipId, bounds, mergedTpl, currentEdits)
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
  await prisma.clip.update({ where: { id: clipId }, data: { edits: toPrismaJson(edits) } })
  return edits
}

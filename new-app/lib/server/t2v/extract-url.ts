import 'server-only'
import { classifyImportUrl } from '@/lib/clips/import-url'

const BLOCKED = new Set(['youtube', 'drive', 'dropbox', 'twitch', 'kick'])

function stripHtml(html: string): string {
  const noScript = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  const text = noScript.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return text
}

export async function extractArticleFromUrl(url: string): Promise<{ title: string; text: string; excerpt: string }> {
  const kind = classifyImportUrl(url)
  if (BLOCKED.has(kind)) {
    throw new Error('t2v_extract_url_blocked')
  }
  let parsed: URL
  try {
    parsed = new URL(url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`)
  } catch {
    throw new Error('t2v_extract_invalid_url')
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('t2v_extract_invalid_url')

  const res = await fetch(parsed.toString(), {
    headers: { 'User-Agent': 'TransovoT2VExtract/1.0', Accept: 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(30_000),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`t2v_extract_fetch_${res.status}`)
  const html = await res.text()
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch?.[1]?.trim() || parsed.hostname
  const text = stripHtml(html)
  if (text.length < 80) throw new Error('t2v_extract_too_short')
  return { title, text, excerpt: text.slice(0, 600) }
}

import 'server-only'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'

function deepgramKey(): string | null {
  const k = process.env.DEEPGRAM_API_KEY?.trim()
  return k || null
}

export async function transcribeClipUpload(workspaceId: string, uploadId: string): Promise<{ text: string; title: string }> {
  const apiKey = deepgramKey()
  if (!apiKey) throw new Error('deepgram_not_configured')

  const upload = await getPrisma().clipUpload.findFirst({
    where: { id: uploadId, workspaceId, status: 'COMPLETE' },
  })
  if (!upload?.key) throw new Error('upload_not_ready')

  const storage = getClipStorage()
  const audioUrl = await storage.createSignedDownloadUrl(upload.key, 3600)
  const model = process.env.DEEPGRAM_MODEL?.trim() || 'nova-3'
  const params = new URLSearchParams({
    model,
    smart_format: 'true',
    punctuate: 'true',
    language: 'en',
  })
  const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: audioUrl }),
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) throw new Error(`deepgram_${res.status}`)
  const payload = (await res.json()) as {
    results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string; words?: Array<{ punctuated_word?: string; word?: string }> }> }> }
  }
  const alt = payload.results?.channels?.[0]?.alternatives?.[0]
  const words = alt?.words ?? []
  const text =
    words.length > 0
      ? words.map((w) => (w.punctuated_word || w.word || '').trim()).filter(Boolean).join(' ')
      : (alt?.transcript || '').trim()
  if (!text) throw new Error('t2v_extract_too_short')
  const title = upload.filename.replace(/\.[^.]+$/, '').slice(0, 120) || 'Audio transcript'
  return { text, title }
}

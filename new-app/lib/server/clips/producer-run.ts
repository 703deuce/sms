import 'server-only'

import { applyProducerToolsWithWords, type ProducerToolCall } from '@/lib/clips/edits-reducer'
import { captionsUnchanged, countProducerFieldChanges } from '@/lib/clips/producer-diff'
import { normalizeEdits, type ClipBounds, type ClipEditsV2, type ClipWord } from '@/lib/clips/edits'
import { getClipStorage } from '@/lib/storage'

export const PRODUCER_SYSTEM_CLIP = `You are the Clips AI Producer. Return JSON: { "reply": string, "tools": [{ "name": string, "args": object }] }.
Allowed tools: trim, set_captions, set_layout, set_title, set_music_mix, add_sfx, remove_broll, insert_stock_broll, generate_ai_broll, generate_music, generate_thumbnail, dub, apply_brand, set_zoom, set_silence_trim, apply_silence_trim.
Paid tools (generate_*, dub) need user confirmation — only include them when the user clearly asks.
apply_brand applies the workspace brand template fields from args (logo/caption preset/intro/outro when present).
For caption changes, prefer ONE set_captions call with all fields (presetId, animation, size, etc.) instead of multiple calls.
Never claim a caption change in reply unless presetId or animation actually changes from the current edits. Pick a different presetId if the user asks for a new style.
set_zoom: { enabled, intensity } where intensity is 1.1–1.3. apply_silence_trim tightens pauses between words (optional minGapMs, keepMs).
Keep edits minimal; one line per change in reply.`

export const PRODUCER_SYSTEM_PROJECT = `You are the Clips AI Producer for an entire project (multiple clips). Return JSON:
{ "reply": string, "actions": [{ "clipId": string, "tools": [{ "name": string, "args": object }] }] }
Use the same tool names as single-clip Producer. Target specific clipIds from the catalog. Prefer batching the same change across clips when the user asks for "all clips".
Paid tools need confirmation — only when clearly requested. Keep reply concise.`

export async function loadClipWords(
  workspaceId: string,
  projectId: string,
  clipId: string,
  transcriptWords: unknown,
): Promise<ClipWord[]> {
  const storage = getClipStorage()
  const key = `ws/${workspaceId}/projects/${projectId}/clips/${clipId}/words.json`
  try {
    const data = await storage.getJson<ClipWord[]>(key)
    if (Array.isArray(data) && data.length) return data
  } catch {
    /* fall through */
  }
  if (Array.isArray(transcriptWords)) return transcriptWords as ClipWord[]
  return []
}

export function runProducerOnClip(
  edits: ClipEditsV2,
  bounds: ClipBounds,
  tools: ProducerToolCall[],
  words: ClipWord[],
) {
  let applied = applyProducerToolsWithWords(edits, bounds, tools, words)
  const wantedCaptions = tools.some((t) => t.name === 'set_captions')
  if (wantedCaptions && captionsUnchanged(edits, applied.edits)) {
    const alt = applyProducerToolsWithWords(edits, bounds, [
      { name: 'set_captions', args: { presetId: 'karaoke', animation: 'karaoke', size: 1.1 } },
    ], words)
    if (!captionsUnchanged(edits, alt.edits)) {
      applied = {
        ...alt,
        summaries: [...applied.summaries.filter((s) => s !== 'No caption change needed'), 'Updated captions'],
        pendingPaid: applied.pendingPaid,
      }
    }
  }
  const summaryCount = applied.summaries.filter(
    (s) => !/^Pending /.test(s) && s !== 'No caption change needed',
  ).length
  const fieldCount = countProducerFieldChanges(edits, applied.edits)
  const changeCount = Math.max(summaryCount, fieldCount)
  return { ...applied, changeCount }
}

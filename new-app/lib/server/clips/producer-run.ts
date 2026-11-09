import 'server-only'

import { applyProducerToolsWithWords, type ProducerToolCall } from '@/lib/clips/edits-reducer'
import {
  captionStylesEqual,
  pickAlternateCaptionPreset,
  resolvedCaptionStyle,
  sanitizeProducerCaptionReply,
} from '@/lib/clips/producer-captions'
import { countProducerFieldChanges } from '@/lib/clips/producer-diff'
import {
  appliedProducerSummaries,
  honestProducerReply,
  promoteMusicIntentFromMessage,
  promoteMusicMixWithoutMusic,
} from '@/lib/clips/producer-honesty'
import { normalizeEdits, type ClipBounds, type ClipEditsV2, type ClipWord } from '@/lib/clips/edits'
import { getClipStorage } from '@/lib/storage'

export const PRODUCER_SYSTEM_CLIP = `You are the Clips AI Producer. Return JSON: { "reply": string, "tools": [{ "name": string, "args": object }] }.
Allowed tools: trim, set_captions, set_layout, set_title, add_text_overlay, set_music_mix, add_sfx, remove_broll, insert_stock_broll, generate_ai_broll, generate_music, generate_thumbnail, dub, apply_brand, set_zoom, set_silence_trim, apply_silence_trim.
Paid tools (generate_*, dub): when the user clearly asks for one, INCLUDE the tool call — the app shows a cost card with Generate / Skip, which is the confirmation. Never ask for confirmation in the reply text. "Add (background) music" on a clip without music = generate_music { prompt }.
apply_brand applies the workspace brand template fields from args (logo/caption preset/intro/outro when present).
For caption changes, prefer ONE set_captions call with all fields (presetId, animation, size, etc.) instead of multiple calls.
Never claim a caption change in reply unless presetId or animation actually changes from the current edits. Pick a different presetId if the user asks for a new style.
add_text_overlay: { kind: 'title_card'|'lower_third', text: string, atMs: integer, durationMs: integer }. This creates a REAL editable Text layer on the output timeline. Use one call for EACH requested overlay. For 'at 0:30', atMs=30000. The text must be specified; when no words were provided, propose a short, context-grounded title, not fake facts. A motion GRAPHICS generation request is different: direct the user to the AI Motion Graphics panel, not an imaginary tool.
Never say an edit was saved/applied: this chat generates proposals and the user must press Accept to save. Only describe the tools the model proposes.
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
  rawTools: ProducerToolCall[],
  words: ClipWord[],
  assistantReply?: string,
  userMessage?: string,
) {
  // E4fix: "add music" on a clip without music → generate_music cost card (nothing generated yet).
  // EP1: also when the model returned no music tool at all (it asked in text instead).
  const tools = promoteMusicIntentFromMessage(edits, promoteMusicMixWithoutMusic(edits, rawTools), userMessage)
  let applied = applyProducerToolsWithWords(edits, bounds, tools, words)
  const wantedCaptions = tools.some((t) => t.name === 'set_captions')
  if (wantedCaptions && captionStylesEqual(edits, applied.edits)) {
    const cur = resolvedCaptionStyle(edits.captions).presetId
    const altArgs = pickAlternateCaptionPreset(cur)
    const alt = applyProducerToolsWithWords(
      edits,
      bounds,
      [{ name: 'set_captions', args: { ...altArgs, size: 1.05 } }],
      words,
    )
    if (!captionStylesEqual(edits, alt.edits)) {
      applied = {
        ...alt,
        summaries: [
          ...applied.summaries.filter((s) => s !== 'Updated captions' && s !== 'No caption change needed'),
          'Updated captions',
        ],
        pendingPaid: applied.pendingPaid,
      }
    } else {
      applied = {
        ...applied,
        summaries: applied.summaries.filter((s) => s !== 'Updated captions'),
      }
    }
  }
  // E4fix: no-op summaries ("No music to mix", …) are not changes.
  const summaryCount = appliedProducerSummaries(applied.summaries).length
  const fieldCount = countProducerFieldChanges(edits, applied.edits)
  // Tool summaries are not evidence of a successful editor mutation.
  // In particular, unsupported tools and legacy set_title must not enable
  // the Accept button or claim that anything was applied.
  const changed=JSON.stringify(edits)!==JSON.stringify(applied.edits)
  const changeCount=changed?Math.max(1,summaryCount,fieldCount):0
  const captionReply = assistantReply
    ? sanitizeProducerCaptionReply(assistantReply, edits, applied.edits, wantedCaptions)
    : undefined
  const reply = assistantReply ? honestProducerReply(captionReply, changeCount, applied.pendingPaid, applied.summaries) : undefined
  return { ...applied, changeCount, reply }
}

import 'server-only'
import { openAiJsonResponse } from '@/lib/server/ai/openai-json'
import { createId } from '@/lib/supabase/id'
import type { T2vAspect, T2vDraftV1, T2vScene } from '@/lib/t2v/types'

export type T2vProducerToolCall = { name: string; args: Record<string, unknown> }

export const T2V_PRODUCER_TOOL_NAMES = [
  'rewrite_scene',
  'delete_scene',
  'add_scene',
  'reorder_scenes',
  'set_voice',
  'set_aspect',
  'swap_visual',
  'shorten_to',
  'rebuild',
] as const

async function rewriteSceneNarration(scene: T2vScene, instruction: string, doc: T2vDraftV1): Promise<string> {
  const out = await openAiJsonResponse<{ narration: string }>(
    'Rewrite only the spoken narration for one scene. Return JSON {"narration": string}. Keep similar length unless asked to shorten or lengthen.',
    `Scene ${scene.slot + 1} current narration:\n${scene.narration}\n\nInstruction: ${instruction}\nTone: ${doc.settings.tone}`,
  )
  return (out.narration || scene.narration).trim()
}

function newScene(slot: number, narration: string): T2vScene {
  return {
    id: createId('sc'),
    slot,
    narration,
    keywords: [],
    visualQuery: narration.split(/\s+/).slice(0, 5).join(' '),
    media: { provider: 'color', kind: 'color', color: '#1a1a2e' },
    padMs: 400,
    transition: 'fade',
    transitionMs: 500,
    texts: [],
    voice: { hash: '', status: 'pending' },
  }
}

export async function applyT2vProducerTools(
  doc: T2vDraftV1,
  tools: T2vProducerToolCall[],
): Promise<{ document: T2vDraftV1; summaries: string[]; requestRebuild: boolean }> {
  let next = { ...doc, scenes: [...doc.scenes] }
  const summaries: string[] = []
  let requestRebuild = false

  for (const t of tools) {
    switch (t.name) {
      case 'rewrite_scene': {
        const sceneId = String(t.args.sceneId ?? t.args.scene ?? '')
        const idx = next.scenes.findIndex((s) => s.id === sceneId || String(s.slot + 1) === sceneId)
        if (idx < 0) {
          summaries.push(`Scene not found (${sceneId})`)
          break
        }
        const instruction = String(t.args.instruction ?? t.args.text ?? 'Make it punchier')
        const narration = await rewriteSceneNarration(next.scenes[idx], instruction, next)
        next.scenes[idx] = { ...next.scenes[idx], narration }
        summaries.push(`Rewrote scene ${idx + 1}`)
        break
      }
      case 'delete_scene': {
        const sceneId = String(t.args.sceneId ?? '')
        const before = next.scenes.length
        next.scenes = next.scenes.filter((s) => s.id !== sceneId && String(s.slot + 1) !== sceneId)
        if (next.scenes.length < before) summaries.push('Deleted a scene')
        break
      }
      case 'add_scene': {
        const after = t.args.after != null ? String(t.args.after) : null
        const narration = String(t.args.narration ?? 'New scene narration.')
        const slot = next.nextSlot
        const scene = newScene(slot, narration)
        next.nextSlot = slot + 1
        if (after) {
          const idx = next.scenes.findIndex((s) => s.id === after || String(s.slot + 1) === after)
          if (idx >= 0) next.scenes.splice(idx + 1, 0, scene)
          else next.scenes.push(scene)
        } else next.scenes.push(scene)
        summaries.push('Added a scene')
        break
      }
      case 'reorder_scenes': {
        const order = t.args.order as string[] | undefined
        if (order?.length) {
          const byId = new Map(next.scenes.map((s) => [s.id, s]))
          const reordered = order.map((id) => byId.get(id)).filter(Boolean) as T2vScene[]
          if (reordered.length) {
            next.scenes = reordered
            summaries.push('Reordered scenes')
          }
        }
        break
      }
      case 'set_voice': {
        const voiceId = String(t.args.voiceId ?? '')
        const voiceName = String(t.args.voiceName ?? t.args.description ?? 'Custom voice')
        if (voiceId) {
          next.voice = {
            provider: 'elevenlabs',
            voiceId,
            voiceName,
            modelId: next.voice?.modelId ?? 'eleven_v4',
            stability: next.voice?.stability ?? 0.5,
            similarityBoost: next.voice?.similarityBoost ?? 0.75,
            style: next.voice?.style ?? 0,
            speed: next.voice?.speed ?? 1,
          }
          summaries.push(`Voice set to ${voiceName}`)
        }
        break
      }
      case 'set_aspect': {
        const aspect = t.args.aspect as T2vAspect
        if (aspect) {
          next.settings = { ...next.settings, aspect }
          summaries.push(`Aspect ${aspect}`)
        }
        break
      }
      case 'swap_visual': {
        const sceneId = String(t.args.sceneId ?? '')
        const idx = next.scenes.findIndex((s) => s.id === sceneId || String(s.slot + 1) === sceneId)
        if (idx >= 0 && t.args.query) {
          next.scenes[idx] = { ...next.scenes[idx], visualQuery: String(t.args.query) }
          summaries.push(`Updated visual query for scene ${idx + 1}`)
        }
        break
      }
      case 'shorten_to': {
        const sec = Number(t.args.seconds ?? t.args.durationS ?? 60)
        if (sec > 0) {
          next.settings = {
            ...next.settings,
            targetDurationS: sec <= 30 ? 30 : sec <= 60 ? 60 : sec <= 90 ? 90 : sec <= 120 ? 120 : 180,
          }
          summaries.push(`Target length ~${sec}s`)
        }
        break
      }
      case 'rebuild':
        requestRebuild = true
        summaries.push('Rebuild requested')
        break
      default:
        summaries.push(`Unknown tool ${t.name}`)
    }
  }

  return { document: next, summaries, requestRebuild }
}

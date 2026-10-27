import 'server-only'
import { openAiJsonResponse } from '@/lib/server/ai/openai-json'
import { createId } from '@/lib/supabase/id'
import { estimateDraftMs } from '@/lib/server/t2v/music'
import { getPrisma } from '@/lib/server/db'
import type { T2vAspect, T2vDraftV1, T2vScene } from '@/lib/t2v/types'

const ASPECTS: T2vAspect[] = ['16:9', '9:16', '1:1', '4:5']

function sceneIndex(scenes: T2vScene[], ref: unknown): number {
  const raw = ref != null ? String(ref) : ''
  const n = Number(raw)
  if (raw && Number.isInteger(n) && n >= 1 && n <= scenes.length) return n - 1
  return scenes.findIndex((s) => s.id === raw)
}

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
    `Scene narration:\n${scene.narration}\n\nInstruction: ${instruction}\nTone: ${doc.settings.tone}`,
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
  ctx?: { workspaceId: string },
): Promise<{ document: T2vDraftV1; summaries: string[]; requestRebuild: boolean }> {
  let next = { ...doc, scenes: [...doc.scenes] }
  const summaries: string[] = []
  let requestRebuild = false

  for (const t of tools) {
    switch (t.name) {
      case 'rewrite_scene': {
        const idx = sceneIndex(next.scenes, t.args.sceneId ?? t.args.scene ?? t.args.position)
        if (idx < 0) {
          summaries.push(`Scene not found (${String(t.args.sceneId ?? t.args.position ?? '')})`)
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
          const missing = next.scenes.filter((s) => !order.includes(s.id))
          if (reordered.length) {
            next.scenes = [...reordered, ...missing]
            summaries.push('Reordered scenes')
          }
        }
        break
      }
      case 'set_voice': {
        let voiceId = String(t.args.voiceId ?? '')
        let voiceName = String(t.args.voiceName ?? t.args.description ?? 'Custom voice')
        if (!voiceId && ctx?.workspaceId && voiceName) {
          const hit = await getPrisma().t2vSavedVoice.findFirst({
            where: {
              workspaceId: ctx.workspaceId,
              name: { contains: voiceName, mode: 'insensitive' },
            },
          })
          if (hit) {
            voiceId = hit.voiceId
            voiceName = hit.name
          }
        }
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
          next.scenes = next.scenes.map((s) => ({
            ...s,
            voice: { ...(s.voice ?? { hash: '' }), status: 'stale' as const },
          }))
          summaries.push(`Voice set to ${voiceName}`)
        }
        break
      }
      case 'set_aspect': {
        const aspect = t.args.aspect as T2vAspect
        if (aspect && ASPECTS.includes(aspect)) {
          next.settings = { ...next.settings, aspect }
          summaries.push(`Aspect ${aspect}`)
        }
        break
      }
      case 'swap_visual': {
        const idx = sceneIndex(next.scenes, t.args.sceneId ?? t.args.position)
        if (idx >= 0 && t.args.query) {
          next.scenes[idx] = { ...next.scenes[idx], visualQuery: String(t.args.query) }
          summaries.push(`Updated visual query for scene ${idx + 1}`)
        }
        break
      }
      case 'shorten_to': {
        const sec = Number(t.args.seconds ?? t.args.durationS ?? 60)
        if (sec > 0) {
          const bucket = sec <= 30 ? 30 : sec <= 60 ? 60 : sec <= 90 ? 90 : sec <= 120 ? 120 : 180
          next.settings = { ...next.settings, targetDurationS: bucket as typeof next.settings.targetDurationS }
          const targetMs = sec * 1000
          while (next.scenes.length > 1 && estimateDraftMs(next) > targetMs) {
            next.scenes = next.scenes.slice(0, -1)
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

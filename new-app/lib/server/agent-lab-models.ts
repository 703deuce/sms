import 'server-only'

import { AgentLabError, agentLabJson } from '@/lib/server/agent-lab'

/** LiteLLM-style id, e.g. deepseek/deepseek-flash. */
export type LabModelId = string
export type ProviderId = 'deepseek' | 'gemini' | 'anthropic' | 'openai'

export type ModelInfo = {
  id: LabModelId
  label: string
  provider: ProviderId
}

export type ProviderInfo = {
  id: ProviderId
  label: string
  hasKey: boolean
  needsKey?: string
  models: ModelInfo[]
}

type ProviderMeta = {
  label: string
  profile: string
  fallbackProfiles: string[]
  needsKey: string
}

const PROVIDER_META: Record<ProviderId, ProviderMeta> = {
  deepseek: { label: 'DeepSeek', profile: 'lab-deepseek', fallbackProfiles: [], needsKey: 'DEEPSEEK_API_KEY' },
  gemini: { label: 'Google Gemini', profile: 'lab-gemini', fallbackProfiles: ['fallback-gemini'], needsKey: 'GEMINI_API_KEY' },
  openai: { label: 'OpenAI', profile: 'lab-openai', fallbackProfiles: [], needsKey: 'OPENAI_API_KEY' },
  anthropic: { label: 'Anthropic', profile: 'lab-anthropic', fallbackProfiles: [], needsKey: 'ANTHROPIC_API_KEY' },
}

/**
 * Curated chat/agent models. Every id was checked against that provider's models API
 * on 23 Nov 2026 (America/New_York). Anthropic models are listed once lab-anthropic exists on the agent server. gemini-2.5-flash removed (Google: no longer available to new users).
 */
const CATALOG: ModelInfo[] = [
  { id: 'deepseek/deepseek-flash', label: 'DeepSeek Flash', provider: 'deepseek' },
  { id: 'deepseek/deepseek-v4-pro', label: 'DeepSeek V4 Pro', provider: 'deepseek' },

  { id: 'gemini/gemini-flash-latest', label: 'Gemini Flash Latest', provider: 'gemini' },
  { id: 'gemini/gemini-pro-latest', label: 'Gemini Pro Latest', provider: 'gemini' },
  { id: 'gemini/gemini-4-hydrogen', label: 'Gemini 4 Hydrogen', provider: 'gemini' },
  { id: 'gemini/gemini-4-carbon', label: 'Gemini 4 Carbon', provider: 'gemini' },
  { id: 'gemini/gemini-4-argon', label: 'Gemini 4 Argon', provider: 'gemini' },
  { id: 'gemini/gemini-3.8-flash', label: 'Gemini 3.8 Flash', provider: 'gemini' },
  { id: 'gemini/gemini-3.5-flash', label: 'Gemini 3.5 Flash', provider: 'gemini' },
  { id: 'gemini/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview', provider: 'gemini' },
  { id: 'gemini/gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'gemini' },

  { id: 'anthropic/claude-haiku-5-5', label: 'Claude Haiku 5.5', provider: 'anthropic' },
  { id: 'anthropic/claude-sonnet-5-5', label: 'Claude Sonnet 5.5', provider: 'anthropic' },
  { id: 'anthropic/claude-opus-5-5', label: 'Claude Opus 5.5', provider: 'anthropic' },
  { id: 'openai/gpt-6.2-sol', label: 'GPT-6.2 Sol', provider: 'openai' },
  { id: 'openai/gpt-6.2-astra', label: 'GPT-6.2 Astra', provider: 'openai' },
  { id: 'openai/gpt-6.1-sol', label: 'GPT-6.1 Sol', provider: 'openai' },
  { id: 'openai/gpt-6-sol', label: 'GPT-6 Sol', provider: 'openai' },
  { id: 'openai/gpt-5.6-sol', label: 'GPT-5.6 Sol', provider: 'openai' },
  { id: 'openai/gpt-5.5', label: 'GPT-5.5', provider: 'openai' },
  { id: 'openai/gpt-5.5-pro', label: 'GPT-5.5 Pro', provider: 'openai' },
  { id: 'openai/gpt-5.4', label: 'GPT-5.4', provider: 'openai' },
  { id: 'openai/gpt-5.4-mini', label: 'GPT-5.4 Mini', provider: 'openai' },
  { id: 'openai/gpt-5.3-codex', label: 'GPT-5.3 Codex', provider: 'openai' },
  { id: 'openai/gpt-5', label: 'GPT-5', provider: 'openai' },
  { id: 'openai/gpt-5-mini', label: 'GPT-5 Mini', provider: 'openai' },
  { id: 'openai/gpt-4.1', label: 'GPT-4.1', provider: 'openai' },
  { id: 'openai/gpt-4o', label: 'GPT-4o', provider: 'openai' },
  { id: 'openai/o3', label: 'o3', provider: 'openai' },
]

const PROVIDER_ORDER: ProviderId[] = ['deepseek', 'gemini', 'anthropic', 'openai']

export function providerOf(modelId: string | null | undefined): ProviderId | null {
  if (!modelId) return null
  const prefix = modelId.split('/')[0]
  if (prefix === 'deepseek' || prefix === 'gemini' || prefix === 'openai' || prefix === 'anthropic') return prefix
  if (prefix === 'google') return 'gemini'
  return null
}

export function labelOf(modelId: string | null | undefined): string {
  if (!modelId) return ''
  const hit = CATALOG.find((m) => m.id === modelId)
  if (hit) return hit.label
  return modelId.includes('/') ? modelId.slice(modelId.indexOf('/') + 1) : modelId
}

/** The model a conversation is currently on (OpenHands conversation payload). */
export function conversationModel(info: { agent?: { llm?: { model?: string | null } | null } | null; current_model_id?: string | null } | null | undefined): string | null {
  const model = info?.agent?.llm?.model || info?.current_model_id
  return typeof model === 'string' && model.trim() ? model.trim() : null
}

type ProfileResponse = { name?: string; config?: Record<string, unknown> | null }

async function loadProfile(name: string): Promise<Record<string, unknown> | null> {
  try {
    const profile = await agentLabJson<ProfileResponse>(`/api/profiles/${encodeURIComponent(name)}`, {
      headers: { 'X-Expose-Secrets': 'encrypted' },
    })
    return profile.config && typeof profile.config === 'object' ? profile.config : null
  } catch {
    return null
  }
}

async function providerConfig(provider: ProviderId): Promise<Record<string, unknown> | null> {
  const meta = PROVIDER_META[provider]
  for (const name of [meta.profile, ...meta.fallbackProfiles]) {
    const cfg = await loadProfile(name)
    if (cfg) return cfg
  }
  if (provider === 'deepseek') {
    const settings = await agentLabJson<{ agent_settings?: { llm?: Record<string, unknown> } }>('/api/settings', {
      headers: { 'X-Expose-Secrets': 'encrypted' },
    })
    const llm = settings.agent_settings?.llm
    if (llm && typeof llm === 'object') return llm
  }
  return null
}

export async function listLabModels(): Promise<{ providers: ProviderInfo[]; defaultModel: string }> {
  const settings = await agentLabJson<{ agent_settings?: { llm?: { model?: string } } }>('/api/settings')
  const defaultModel = settings.agent_settings?.llm?.model || 'deepseek/deepseek-v4-pro'

  const hasKey = {} as Record<ProviderId, boolean>
  await Promise.all(
    PROVIDER_ORDER.map(async (id) => {
      hasKey[id] = (await providerConfig(id)) != null
    }),
  )

  const providers: ProviderInfo[] = PROVIDER_ORDER.map((id) => {
    const meta = PROVIDER_META[id]
    const ready = Boolean(hasKey[id])
    return {
      id,
      label: meta.label,
      hasKey: ready,
      needsKey: ready ? undefined : meta.needsKey,
      models: ready ? CATALOG.filter((m) => m.provider === id) : [],
    }
  })

  return { providers, defaultModel }
}

/** LLM config for a conversation create or mid-run switch (keys stay encrypted on the agent server). */
export async function llmConfigForModel(modelId: string): Promise<Record<string, unknown>> {
  const provider = providerOf(modelId)
  if (!provider) throw new AgentLabError(`Unknown model ${modelId}`, 400)
  if (!CATALOG.some((m) => m.id === modelId) && provider !== 'anthropic') {
    // Allow a conversation that is already on a model we did not curate (e.g. a dated snapshot).
  }
  const meta = PROVIDER_META[provider]
  const cfg = await providerConfig(provider)
  if (!cfg) {
    throw new AgentLabError(`${meta.label} needs ${meta.needsKey} on the agent server before you can use it`, 400)
  }
  return { ...cfg, model: modelId }
}

/** Switch this conversation's model between turns (OpenHands switch_llm, same path as profile fallback). */
export async function switchConversationModel(conversationId: string, modelId: string): Promise<{ id: string; model: string }> {
  const llm = await llmConfigForModel(modelId)
  await agentLabJson(`/api/conversations/${encodeURIComponent(conversationId)}/switch_llm`, {
    method: 'POST',
    body: JSON.stringify({ llm }),
    timeoutMs: 30_000,
  })
  return { id: conversationId, model: modelId }
}

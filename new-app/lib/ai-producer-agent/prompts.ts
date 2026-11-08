import { readFileSync } from 'node:fs'
import path from 'node:path'

const PROMPTS_ROOT = path.join(process.cwd(), 'lib/ai-producer-agent/prompts')
const RULEPACK_ROOT = path.join(process.cwd(), 'lib/ai-producer-agent/rulepacks')

/** Max separate editor projects the agent may create in one run (system prompt + orchestrator). */
export const AI_PRODUCER_MAX_EDITS_PER_RUN = 3

export type AgentOutputType = 'single_payoff' | 'montage' | 'story' | 'auto'

export type AgentPromptContext = {
  genre: string
  /** User-selected or `auto` (DECIDE step resolves to single_payoff | montage | story). */
  outputType: AgentOutputType
  /** Resolved type for template/platform when outputType is auto (optional until DECIDE). */
  resolvedOutputType?: 'single_payoff' | 'montage' | 'story'
  platform: 'tiktok' | 'shorts' | 'reels'
  editMode?: 'just_chatting_rough_cut'
  clipAgentMode?: 'moment' | 'story'
}

function readText(root: string, name: string): string {
  try {
    return readFileSync(path.join(root, name), 'utf8').trim()
  } catch {
    return ''
  }
}

function outputTemplateSection(ctx: AgentPromptContext): string {
  const key =
    ctx.outputType === 'auto'
      ? 'auto'
      : ctx.resolvedOutputType ?? (ctx.outputType === 'story' ? 'story' : ctx.outputType)
  const blob = readText(RULEPACK_ROOT, 'output-templates.md')
  const marker =
    key === 'montage'
      ? '## Output template: montage'
      : key === 'story'
        ? '## Output template: story'
        : key === 'auto'
          ? '## Output template: auto'
          : '## Output template: single_payoff'
  const idx = blob.indexOf(marker)
  if (idx < 0) return marker
  const next = blob.indexOf('\n## Output template:', idx + 1)
  return blob.slice(idx, next > idx ? next : undefined).trim()
}

function platformTargetSection(platform: string): string {
  const blob = readText(RULEPACK_ROOT, 'platform-targets.md')
  const marker = `### ${platform}`
  const idx = blob.indexOf(marker)
  if (idx < 0) return `Platform target: ${platform}.`
  const next = blob.indexOf('\n### ', idx + 1)
  const section = blob.slice(idx, next > idx ? next : undefined).trim()
  return `## Platform targets\n\n${section}`
}

/**
 * Stable system prompt for Luna caching: base system.md, then CORE, genre, output template, platform.
 */
export function buildAgentSystemPrompt(ctx: AgentPromptContext): string {
  const base = readText(PROMPTS_ROOT, 'system.md')
  const core = readText(RULEPACK_ROOT, 'core-source.md') || readText(RULEPACK_ROOT, 'core.md')
  const genre =
    ctx.genre === 'irl_just_chatting'
      ? readText(RULEPACK_ROOT, 'irl_just_chatting.md')
      : ''
  const template = outputTemplateSection(ctx)
  const platform = platformTargetSection(ctx.platform)
  if(ctx.clipAgentMode){
    return [
      readText(PROMPTS_ROOT,'system.md'),
      readText(RULEPACK_ROOT,'core-source.md') || readText(RULEPACK_ROOT,'core.md'),
      ctx.clipAgentMode==='moment'
        ? 'STREAMER SINGLE MOMENT CLIP: Reuse the approved Story, Footage, Flow, QA and source validation pipeline, but produce exactly one continuous source interval with real setup, action, reaction and payoff. Do not montage or artificially splice separate events. Honor the requested short-form duration and source boundaries.'
        : 'STREAMER AI STORY CLIP: Reuse the approved Story, Footage, Flow and QA agents to construct one coherent short-form mini-story out of multiple grounded source sections. Keep context and payoff, respect the short-form duration, and never rewrite the original long-form gaming video.',
      outputTemplateSection(ctx),
      platformTargetSection(ctx.platform),
    ].filter(Boolean).join('\n\n---\n\n')
  }
  if (ctx.editMode === 'just_chatting_rough_cut') {
    // Short-form pack limits and payoff caps do not apply to this long edit.
    const longForm = readText(RULEPACK_ROOT, 'just_chatting_rough_cut.md')
    return [
      'You are editing a long-form Just Chatting stream into a coherent, editable rough cut. Follow the skill below, not short-form clip rules.',
      readText(RULEPACK_ROOT, 'core.md'),
      longForm,
    ].filter(Boolean).join('\n\n---\n\n')
  }
  return [base, core, genre, template, platform].filter(Boolean).join('\n\n---\n\n')
}

/** Strip leading comment lines from system.md for model-facing text (keeps body verbatim). */
export function stripPromptFileComments(markdown: string): string {
  const lines = markdown.split('\n')
  while (lines.length && lines[0].trimStart().startsWith('#')) {
    const line = lines[0].trim()
    if (line.startsWith('# AI Producer:') || line.startsWith('# Loaded as:')) {
      lines.shift()
      continue
    }
    break
  }
  return lines.join('\n').trimStart()
}

export function buildAgentSystemPromptForModel(ctx: AgentPromptContext): string {
  const full = buildAgentSystemPrompt(ctx)
  const parts = full.split('\n\n---\n\n')
  if (parts.length) parts[0] = stripPromptFileComments(parts[0])
  return parts.join('\n\n---\n\n')
}

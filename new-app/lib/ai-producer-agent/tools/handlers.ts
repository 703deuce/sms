import type { EditPlanJson } from '@/lib/ai-producer-agent/types'

export type ToolHandler = (args: Record<string, unknown>) => Promise<Record<string, unknown>>

export const toolHandlers: Record<string, ToolHandler> = {
  async find_moments(args) {
    return { ok: true, mode: args.mode ?? 'best_moments' }
  },
  async create_project(args) {
    return { ok: true, title: args.title }
  },
  async self_review() {
    return { ok: true, checks: [] }
  },
}

export async function dispatchTool(name: string, args: Record<string, unknown>) {
  const fn = toolHandlers[name]
  if (!fn) throw new Error(`unknown_tool:${name}`)
  return fn(args)
}

export type { EditPlanJson }

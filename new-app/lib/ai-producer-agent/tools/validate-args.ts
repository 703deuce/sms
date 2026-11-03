import { TOOL_SCHEMAS } from '@/lib/ai-producer-agent/tools/schemas'

type Schema = { type?: string; required?: string[]; properties?: Record<string, { type?: string; enum?: unknown[] }> }

export function validateToolArgs(name: string, args: unknown): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  if (args != null && typeof args !== 'object') return { ok: false, error: 'args must be object' }
  const schema = TOOL_SCHEMAS.find((t) => t.name === name)
  if (!schema) return { ok: false, error: `unknown tool ${name}` }
  const params = schema.parameters as Schema
  const value = (args ?? {}) as Record<string, unknown>
  for (const key of params.required ?? []) {
    if (value[key] === undefined || value[key] === null) return { ok: false, error: `missing ${key}` }
  }
  for (const [key, val] of Object.entries(value)) {
    const prop = params.properties?.[key]
    if (!prop) continue
    if (prop.enum && !prop.enum.includes(val)) return { ok: false, error: `bad enum ${key}` }
  }
  return { ok: true, value }
}

/** Durable checkpoint payloads contain pointers, not in-memory file handles or signed URLs. */
export type ProducerCheckpoint = { revision: number; state: Record<string, unknown> }
export function validateProducerCheckpoint(raw: unknown, current: unknown): ProducerCheckpoint {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
  if (!o.checkpoint || typeof o.checkpoint !== 'object' || Array.isArray(o.checkpoint))
    throw new Error('Checkpoint must be a JSON object.')
  const revision = Number(o.revision)
  if (!Number.isSafeInteger(revision) || revision < 1) throw new Error('Checkpoint revision must be a positive integer.')
  const state = o.checkpoint as Record<string, unknown>
  const encoded = JSON.stringify(state)
  if (!encoded || encoded.length > 256_000) throw new Error('Checkpoint must be under 256 KB.')
  const old = current && typeof current === 'object' && !Array.isArray(current) ? current as Record<string, unknown> : {}
  const previous = Number(old.revision) || 0
  if (revision < previous) throw new Error('Stale checkpoint revision.')
  if (revision === previous && JSON.stringify(old.state) !== encoded)
    throw new Error('Checkpoint revision already used with different state.')
  return { revision, state }
}

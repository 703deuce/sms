/** Durable checkpoint payloads contain pointers, not in-memory file handles or signed URLs. */
export type ProducerCheckpoint = { revision: number; state: Record<string, unknown> }
export function validateProducerCheckpoint(raw: unknown, current: unknown): ProducerCheckpoint {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
  if (!o.checkpoint || typeof o.checkpoint !== 'object' || Array.isArray(o.checkpoint))
    throw new Error('Checkpoint must be a JSON object.')
  const revision = Number(o.revision)
  if (!Number.isSafeInteger(revision) || revision < 1) throw new Error('Checkpoint revision must be a positive integer.')
  const state = o.checkpoint as Record<string, unknown>
  // Checkpoints only hold stable references and progress. They must never become
  // a durable store for signed media URLs, storage paths or access credentials.
  const inspect = (value: unknown, path: string, depth: number): void => {
    if (depth > 24) throw new Error('Checkpoint is too deeply nested.')
    if (typeof value === 'string') {
      if (/(?:s3:\/\/|gs:\/\/|\bBearer\s+|(?:^|\s|\/)ws\/[^\s]+)/i.test(value) ||
          (/\bhttps?:\/\//i.test(value) && (/(?:[?&](?:X-Amz-|Signature|Expires=|token=|X-Goog-)|(?:https?:\/\/\S+\.(?:mp4|mov|wav|png|jpg)(?:\?|$)))/i.test(value) || /(?:^|\.)(?:url|downloadUrl|signedLink)$/i.test(path))))
        throw new Error('Checkpoint must contain stable asset IDs, not signed URLs or storage keys.')
      return
    }
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) { value.forEach((item, i) => inspect(item, path + '.' + i, depth + 1)); return }
    for (const [key, item] of Object.entries(value)) {
      if (/(?:token|secret|password|credential|authorization|signature|signedurl|storagekey|objectkey|accesskey|privatekey|api.?key)/i.test(key))
        throw new Error('Checkpoint contains a prohibited credential or storage field.')
      inspect(item, path + '.' + key, depth + 1)
    }
  }
  inspect(state, 'checkpoint', 0)
  const encoded = JSON.stringify(state)
  if (!encoded || encoded.length > 256_000) throw new Error('Checkpoint must be under 256 KB.')
  const old = current && typeof current === 'object' && !Array.isArray(current) ? current as Record<string, unknown> : {}
  const previous = Number(old.revision) || 0
  if (revision < previous) throw new Error('Stale checkpoint revision.')
  if (revision === previous && JSON.stringify(old.state) !== encoded)
    throw new Error('Checkpoint revision already used with different state.')
  return { revision, state }
}

// Scene filenames and individual digests stay authoritative. A pack is simply
// their original bytes concatenated in stable order, without transcoding.
import { readFile, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
export const MAX_PACK = 16 * 1024 * 1024
export const digest = bytes => createHash('sha256').update(bytes).digest('hex')

export async function mapEight(jobs, run) {
  let next = 0
  let failure
  await Promise.all(Array.from({length: Math.min(8, jobs.length)}, async () => {
    while (!failure && next < jobs.length) {
      const job = jobs[next++]
      try { await run(job) } catch (error) { failure = error }
    }
  }))
  if (failure) throw failure
}

export async function bundleUploads(entries) {
  const tasks = []
  let frames = [], size = 0
  const flush = () => { if (frames.length) tasks.push({frames}); frames = []; size = 0 }
  for (const [rel, file] of entries) {
    if (!/\d+\.(png|webp|jpe?g)$/i.test(rel)) { tasks.push({rel, file}); continue }
    const bytes = (await stat(file)).size
    if (bytes < 1 || bytes > MAX_PACK) { tasks.push({rel, file}); continue }
    if (size + bytes > MAX_PACK) flush()
    frames.push({rel, file})
    size += bytes
  }
  flush()
  return tasks
}

export async function uploadFramePack(store, frames) {
  const chunks = [], members = {}
  let offset = 0
  for (const {rel, file} of frames) {
    const data = await readFile(file)
    members[rel] = {offset, bytes:data.length, sha256:digest(data)}
    chunks.push(data)
    offset += data.length
  }
  if (offset > MAX_PACK) throw new Error('Scene frames changed while packing')
  const data = Buffer.concat(chunks)
  const pack = await store.uploadBuffer(data, {kind:'source', mime:'application/octet-stream',
    filename:digest(data) + '.frames'})
  for (const member of Object.values(members)) {
    member.asset = pack.assetId
    member.packSha256 = pack.sha256
  }
  return members
}

export function unpackFrame(pack, f) {
  if (!Number.isSafeInteger(f.offset) || f.offset < 0 || !Number.isSafeInteger(f.bytes) ||
      f.bytes < 1 || f.offset + f.bytes > pack.length) throw new Error('Invalid packed frame range')
  const frame = pack.subarray(f.offset, f.offset + f.bytes)
  if (digest(frame) !== f.sha256) throw new Error('Packed frame integrity mismatch')
  return frame
}

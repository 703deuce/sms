import 'server-only'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const ROOT = path.join(os.tmpdir(), 'transovo-clip-uploads')

export function chunkFilePath(uploadId: string) {
  return path.join(ROOT, `${uploadId}.bin`)
}

export async function ensureChunkRoot() {
  await fsp.mkdir(ROOT, { recursive: true })
}

export async function appendChunk(uploadId: string, offset: number, body: Buffer): Promise<number> {
  await ensureChunkRoot()
  const file = chunkFilePath(uploadId)
  const stat = await fsp.stat(file).catch(() => null)
  const current = stat?.size ?? 0
  if (offset !== current) {
    throw new Error(`Chunk offset mismatch (expected ${current}, got ${offset})`)
  }
  await fsp.appendFile(file, body)
  return current + body.length
}

export async function chunkBytesReceived(uploadId: string): Promise<number> {
  const file = chunkFilePath(uploadId)
  const stat = await fsp.stat(file).catch(() => null)
  return stat?.size ?? 0
}

export async function openChunkReadStream(uploadId: string) {
  const file = chunkFilePath(uploadId)
  await fsp.access(file)
  return fs.createReadStream(file)
}

export async function removeChunkFile(uploadId: string) {
  await fsp.unlink(chunkFilePath(uploadId)).catch(() => {})
}

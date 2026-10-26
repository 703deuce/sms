import { PassThrough } from 'node:stream'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const archiver = require('archiver') as (format: string, opts?: { zlib: { level: number } }) => import('archiver').Archiver
import type { JSONContent } from '@tiptap/core'
import { pmJsonToFountain } from '@/lib/screenwriting/fountain/convert'

export async function pmJsonToHighlandZip(doc: JSONContent, title = 'Script'): Promise<Buffer> {
  const fountain = pmJsonToFountain(doc)
  const archive = archiver('zip', { zlib: { level: 9 } })
  const stream = new PassThrough()
  const chunks: Buffer[] = []
  stream.on('data', (c) => chunks.push(c as Buffer))
  archive.pipe(stream)
  archive.append(fountain, { name: 'text.fountain' })
  archive.append(JSON.stringify({ title, creator: 'Transovo Screenwriting' }), { name: 'info.json' })
  await archive.finalize()
  await new Promise<void>((resolve) => stream.on('end', () => resolve()))
  return Buffer.concat(chunks)
}

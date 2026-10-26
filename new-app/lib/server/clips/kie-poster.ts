import 'server-only'

import { execFile } from 'child_process'
import { promisify } from 'util'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { readFile, unlink, writeFile } from 'fs/promises'

const execFileAsync = promisify(execFile)

/** Extract first-frame JPEG poster from an MP4 buffer (AI B-roll preview cards). */
export async function mp4BufferToJpegPoster(mp4: Buffer): Promise<Buffer> {
  const id = randomBytes(8).toString('hex')
  const inPath = join(tmpdir(), `kie-poster-${id}.mp4`)
  const outPath = join(tmpdir(), `kie-poster-${id}.jpg`)
  await writeFile(inPath, mp4)
  try {
    await execFileAsync('ffmpeg', [
      '-y',
      '-v',
      'error',
      '-i',
      inPath,
      '-frames:v',
      '1',
      '-q:v',
      '3',
      outPath,
    ])
    return await readFile(outPath)
  } finally {
    await unlink(inPath).catch(() => {})
    await unlink(outPath).catch(() => {})
  }
}

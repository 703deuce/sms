/**
 * Read sample duration from a pinned Ogg/Vorbis asset before registering it
 * in the project library. Ogg granule positions are PCM sample counts.
 * Invalid/unrecognized files must never become selectable 0ms music clips.
 */
export function vorbisDurationMs(buf: Buffer): number {
  let sampleRate = 0
  let finalGranule = 0
  for (let i = 0; i + 27 <= buf.length;) {
    if (buf.toString('ascii', i, i + 4) !== 'OggS') break
    const segCount = buf[i + 26]!
    if (i + 27 + segCount > buf.length) break
    let bodyLen = 0
    for (let j = 0; j < segCount; j++) bodyLen += buf[i + 27 + j]!
    const start = i + 27 + segCount
    if (start + bodyLen > buf.length) break
    if (!sampleRate && bodyLen >= 16 && buf[start] === 1 &&
        buf.toString('ascii', start + 1, start + 7) === 'vorbis') {
      sampleRate = buf.readUInt32LE(start + 12)
    }
    const granule = Number(buf.readBigUInt64LE(i + 6))
    if (Number.isSafeInteger(granule) && granule > finalGranule) finalGranule = granule
    i = start + bodyLen
  }
  return sampleRate && finalGranule ? Math.round(finalGranule / sampleRate * 1000) : 0
}

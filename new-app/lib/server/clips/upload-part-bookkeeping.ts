export type UploadPartRecord = {
  partNumber: number
  etag: string
  sizeBytes?: number | null
}

/** Bytes confirmed uploaded from multipart part records. */
export function bytesReceivedFromParts(parts: UploadPartRecord[], partSize: number, totalBytes: number): number {
  if (!parts.length) return 0
  let sum = 0
  for (const p of parts) {
    if (p.sizeBytes != null && p.sizeBytes > 0) sum += p.sizeBytes
    else sum += partSize
  }
  const maxPart = Math.max(...parts.map((p) => p.partNumber))
  const expectedParts = Math.max(1, Math.ceil(totalBytes / partSize))
  if (maxPart === expectedParts && sum > totalBytes) return totalBytes
  return Math.min(totalBytes, sum)
}

export function missingPartNumbers(
  parts: UploadPartRecord[],
  partSize: number,
  totalBytes: number,
): number[] {
  const expected = Math.max(1, Math.ceil(totalBytes / partSize))
  const done = new Set(parts.map((p) => p.partNumber))
  const missing: number[] = []
  for (let n = 1; n <= expected; n++) {
    if (!done.has(n)) missing.push(n)
  }
  return missing
}

export function mergePartRecords(
  existing: UploadPartRecord[],
  incoming: UploadPartRecord,
): UploadPartRecord[] {
  const map = new Map<number, UploadPartRecord>()
  for (const p of existing) map.set(p.partNumber, p)
  map.set(incoming.partNumber, incoming)
  return [...map.values()].sort((a, b) => a.partNumber - b.partNumber)
}

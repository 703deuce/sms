/** Scan batch processor hook (reputation / growth scans). */
export async function processScanBatch(_batchId: string): Promise<{ ok: boolean }> {
  return { ok: true };
}

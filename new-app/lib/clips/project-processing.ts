/** True while import/transcode/clip pipeline is still running (not terminal). */
export function isClipProjectProcessing(status: string): boolean {
  return status !== 'READY' && status !== 'FAILED' && status !== 'CANCELED' && status !== 'DRAFT'
}

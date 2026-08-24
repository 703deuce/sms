/** Pure transcription minute math — safe to import from tests and client bundles. */

export function audioSecondsToTranscriptionMinutes(
  durationSeconds: number | null | undefined,
): number {
  if (!durationSeconds || durationSeconds <= 0) return 1;
  return Math.max(1, Math.ceil(durationSeconds / 60));
}

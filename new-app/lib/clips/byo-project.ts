export const BYO_MAX_DURATION_MS = 180_000

export const BYO_DURATION_ERROR =
  'Bring-your-own clips can be up to 3 minutes. Use Find clips for longer videos.'

export function assertByoUploadDuration(durationMs: number | null | undefined): void {
  if ((durationMs ?? 0) > BYO_MAX_DURATION_MS) {
    throw new Error(BYO_DURATION_ERROR)
  }
}

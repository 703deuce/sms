export type MsErrorCode = 'INVALID' | 'NOT_FOUND' | 'CONFLICT' | 'STAGE_NOT_RETRYABLE' | 'DISABLED' | 'INTERNAL'

export class MotionStudioError extends Error {
  constructor(public code: MsErrorCode, message: string, public status = 400) {
    super(message)
    this.name = 'MotionStudioError'
  }
}

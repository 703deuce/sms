export type StudioErrorCode =
  | 'INVALID_PARAMS'
  | 'UNKNOWN_MODEL'
  | 'CONCURRENCY_LIMIT'
  | 'JOB_NOT_READY'
  | 'JOB_NOT_FOUND'
  | 'PROJECT_NOT_FOUND'
  | 'KIE_ERROR'
  | 'STORAGE_ERROR'

const STATUS: Record<StudioErrorCode, number> = {
  INVALID_PARAMS: 400,
  UNKNOWN_MODEL: 400,
  CONCURRENCY_LIMIT: 409,
  JOB_NOT_READY: 409,
  JOB_NOT_FOUND: 404,
  PROJECT_NOT_FOUND: 404,
  KIE_ERROR: 502,
  STORAGE_ERROR: 500,
}

export class StudioError extends Error {
  readonly code: StudioErrorCode
  readonly httpStatus: number

  constructor(code: StudioErrorCode, message: string, httpStatus = STATUS[code]) {
    super(message)
    this.name = 'StudioError'
    this.code = code
    this.httpStatus = httpStatus
  }
}

export function isStudioError(err: unknown): err is StudioError {
  return err instanceof StudioError
}

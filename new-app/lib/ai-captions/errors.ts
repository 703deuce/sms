export class AiCaptionsError extends Error {
  readonly code: string
  readonly status: number
  constructor(code: string, message: string, status = 400) {
    super(message)
    this.name = 'AiCaptionsError'
    this.code = code
    this.status = status
  }
}

export function isAiCaptionsError(err: unknown): err is AiCaptionsError {
  return err instanceof AiCaptionsError
}

export function assertNoDollar(message: string): string {
  if (message.includes('$')) {
    return message.replace(/\$/g, '')
  }
  return message
}

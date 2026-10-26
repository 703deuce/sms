/** User-facing copy when a file exceeds the configured upload limit (client preflight or storage 413). */
export function uploadLimitExceededMessage(maxLabel: string): string {
  return `This file is larger than the current upload limit (${maxLabel}). Paste a link instead, or contact support.`
}
